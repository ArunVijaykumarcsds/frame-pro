import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { ExtractedFrame, VideoMetadata, ProcessingState } from '../types'
import { getFrameFilename } from '../utils/format'

const TOTAL_FRAMES = 50
const METADATA_TIMEOUT_MS = 15_000
const WASM_LOAD_TIMEOUT_MS = 60_000

// Max dimension to cap before extraction — prevents WASM memory crash on 4K videos
const MAX_DIMENSION = 1920

let ffmpegInstance: FFmpeg | null = null
let isLoaded = false

const CDN_CONFIGS = [
  {
    label: 'core-mt 0.12.6 (threaded)',
    coreJS: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/esm/ffmpeg-core.js',
    coreWASM: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/esm/ffmpeg-core.wasm',
    coreWorker: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/esm/ffmpeg-core.worker.js',
  },
  {
    label: 'core 0.12.6 jsdelivr',
    coreJS: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    coreWASM: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
    coreWorker: null,
  },
  {
    label: 'core 0.12.6 unpkg',
    coreJS: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    coreWASM: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
    coreWorker: null,
  },
]

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    promise.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

export async function loadFFmpeg(
  onProgress?: (state: Partial<ProcessingState>) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) {
    console.log('[FFmpeg] Reusing instance')
    return ffmpegInstance
  }

  ffmpegInstance = null
  isLoaded = false

  console.log('[FFmpeg] Loading…')
  onProgress?.({ status: 'loading-ffmpeg', message: 'Loading FFmpeg engine…', progress: 0 })

  let loaded = false
  let ffmpeg!: FFmpeg

  for (const cfg of CDN_CONFIGS) {
    try {
      console.log('[FFmpeg] Trying:', cfg.label)
      ffmpeg = new FFmpeg()
      ffmpeg.on('log', ({ type, message }) => console.log(`[FFmpeg:${type}]`, message))

      const coreURL = await withTimeout(
        toBlobURL(cfg.coreJS, 'text/javascript'), WASM_LOAD_TIMEOUT_MS, 'coreJS'
      )
      const wasmURL = await withTimeout(
        toBlobURL(cfg.coreWASM, 'application/wasm'), WASM_LOAD_TIMEOUT_MS, 'coreWASM'
      )

      const loadConfig: Record<string, string> = { coreURL, wasmURL }

      if (cfg.coreWorker) {
        const workerURL = await withTimeout(
          toBlobURL(cfg.coreWorker, 'text/javascript'), WASM_LOAD_TIMEOUT_MS, 'workerJS'
        )
        loadConfig.workerURL = workerURL
      }

      await withTimeout(ffmpeg.load(loadConfig), WASM_LOAD_TIMEOUT_MS, 'ffmpeg.load')
      console.log('[FFmpeg] Loaded OK:', cfg.label)
      loaded = true
      break
    } catch (err) {
      console.warn('[FFmpeg] Failed:', cfg.label, String(err))
    }
  }

  if (!loaded) {
    throw new Error('Failed to load FFmpeg from all sources. Check your internet connection.')
  }

  console.log('[FFmpeg] Running smoke test…')
  try {
    await ffmpeg.exec(['-version'])
    console.log('[FFmpeg] Smoke test passed ✓')
  } catch (err) {
    console.error('[FFmpeg] Smoke test FAILED:', err)
    isLoaded = false
    ffmpegInstance = null
    throw new Error(
      'FFmpeg loaded but exec() crashes immediately (RuntimeError: memory access out of bounds). ' +
      'This is a known issue with @ffmpeg/core in Brave browser with Shields up. ' +
      'Try: (1) Disable Brave Shields for this site, or (2) Use Chrome/Edge instead.'
    )
  }

  ffmpegInstance = ffmpeg
  isLoaded = true
  return ffmpeg
}

export function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    console.log('[Metadata] Reading:', file.name, file.size, 'bytes')
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'

    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Metadata timeout. readyState=${video.readyState}`))
    }, METADATA_TIMEOUT_MS)

    function cleanup() {
      clearTimeout(timer)
      video.onloadedmetadata = null
      video.onerror = null
      URL.revokeObjectURL(url)
    }

    video.onloadedmetadata = () => {
      if (!video.duration || !isFinite(video.duration)) {
        cleanup()
        reject(new Error('Invalid duration: ' + video.duration))
        return
      }
      cleanup()
      resolve({
        name: file.name,
        size: file.size,
        duration: video.duration,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
        type: file.type || 'video/mp4',
      })
    }

    video.onerror = () => {
      cleanup()
      reject(new Error(`MediaError ${video.error?.code}: ${video.error?.message}`))
    }

    video.src = url
    video.load()
  })
}

// Build a scale filter only when the video exceeds MAX_DIMENSION
// This prevents WASM memory access out of bounds on 4K+ videos
function buildScaleFilter(width: number, height: number): string | null {
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) return null
  // Scale down the larger dimension, keep aspect ratio, ensure even numbers (required by JPEG encoder)
  return `scale='if(gt(iw,ih),min(${MAX_DIMENSION},iw),-2)':'if(gt(iw,ih),-2,min(${MAX_DIMENSION},ih))'`
}

export async function extractFrames(
  file: File,
  metadata: VideoMetadata,
  onProgress: (state: Partial<ProcessingState>) => void,
  signal?: AbortSignal
): Promise<ExtractedFrame[]> {
  console.log('[Extract] Starting:', file.name)

  const ffmpeg = await loadFFmpeg(onProgress)
  if (signal?.aborted) throw new Error('Cancelled')

  onProgress({ status: 'analyzing', message: 'Writing video to memory…', progress: 5 })

  const ext = getExtension(file.name)
  const inputFilename = `input${ext}`

  const fileData = await fetchFile(file)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await ffmpeg.writeFile(inputFilename, fileData as any)
  console.log('[Extract] writeFile OK, bytes:', fileData.length)

  if (signal?.aborted) throw new Error('Cancelled')

  const { duration, width, height } = metadata
  const interval = duration / TOTAL_FRAMES
  const frames: ExtractedFrame[] = []

  // Build scale filter based on actual video dimensions
  const scaleFilter = buildScaleFilter(width, height)
  if (scaleFilter) {
    console.log(`[Extract] Applying scale filter (${width}x${height} → max ${MAX_DIMENSION}px): ${scaleFilter}`)
  } else {
    console.log(`[Extract] No scaling needed (${width}x${height})`)
  }

  console.log(`[Extract] duration=${duration}s interval=${interval.toFixed(4)}s`)

  onProgress({
    status: 'extracting',
    message: 'Extracting frames…',
    progress: 10,
    totalFrames: TOTAL_FRAMES,
    currentFrame: 0,
  })

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    if (signal?.aborted) throw new Error('Cancelled')

    const timestamp = i * interval
    const outFile = `frame_${String(i + 1).padStart(2, '0')}.jpg`

    // Only add -vf if video needs scaling — avoids unnecessary re-encode on normal videos
    const args = [
      '-i', inputFilename,
      '-ss', timestamp.toFixed(4),
      '-vframes', '1',
      ...(scaleFilter ? ['-vf', scaleFilter] : []),
      '-q:v', '2',
      '-vsync', '0',
      outFile,
    ]

    try {
      await ffmpeg.exec(args)
    } catch (err) {
      console.warn(`[Extract] exec failed frame ${i + 1}:`, err)
    }

    try {
      const data = await ffmpeg.readFile(outFile)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uint8 = new Uint8Array((data as any).buffer ?? data)
      const blob = new Blob([uint8], { type: 'image/jpeg' })

      // Use scaled dimensions if we applied a filter, otherwise use original
      const outWidth = scaleFilter ? Math.min(width, MAX_DIMENSION) : width
      const outHeight = scaleFilter ? Math.min(height, MAX_DIMENSION) : height

      frames.push({
        id: i + 1,
        frameNumber: i + 1,
        timestamp,
        dataUrl: URL.createObjectURL(blob),
        width: outWidth,
        height: outHeight,
        blob,
      })
      await ffmpeg.deleteFile(outFile)
    } catch {
      console.warn(`[Extract] read failed frame ${i + 1}`)
    }

    onProgress({
      status: 'extracting',
      progress: 10 + Math.floor(((i + 1) / TOTAL_FRAMES) * 88),
      currentFrame: i + 1,
      totalFrames: TOTAL_FRAMES,
      message: `Extracting frame ${i + 1} of ${TOTAL_FRAMES}…`,
    })
  }

  try { await ffmpeg.deleteFile(inputFilename) } catch { /* ignore */ }

  if (frames.length === 0) {
    throw new Error(
      'FFmpeg produced 0 frames. ' +
      'If using Brave, disable Shields for this site and try again. ' +
      'Otherwise try Chrome or Edge.'
    )
  }

  console.log(`[Extract] Done – ${frames.length} frames`)
  onProgress({
    status: 'complete',
    progress: 100,
    currentFrame: frames.length,
    totalFrames: frames.length,
    message: `Extracted ${frames.length} frames`,
  })

  return frames
}

export function releaseFrames(frames: ExtractedFrame[]): void {
  for (const frame of frames) {
    if (frame.dataUrl.startsWith('blob:')) URL.revokeObjectURL(frame.dataUrl)
  }
}

function getExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? '.' + parts.pop()!.toLowerCase() : '.mp4'
}

export function getDownloadFilename(videoName: string, frameNumber: number): string {
  return getFrameFilename(videoName, frameNumber)
}
