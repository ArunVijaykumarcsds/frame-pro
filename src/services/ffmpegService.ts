import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { ExtractedFrame, VideoMetadata, ProcessingState } from '../types'
import { getFrameFilename } from '../utils/format'

const TOTAL_FRAMES = 50
const METADATA_TIMEOUT_MS = 15_000
const WASM_LOAD_TIMEOUT_MS = 40_000

let ffmpegInstance: FFmpeg | null = null
let isLoaded = false

// Use @ffmpeg/core@0.12.9 — has WASM memory fixes vs 0.12.6
const CDN_BASES = [
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.9/dist/esm',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
]

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    promise.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

// ─── loadFFmpeg ───────────────────────────────────────────────────────────────

export async function loadFFmpeg(
  onProgress?: (state: Partial<ProcessingState>) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) {
    console.log('[FFmpeg] Reusing instance')
    return ffmpegInstance
  }

  // Reset stale instance
  ffmpegInstance = null
  isLoaded = false

  console.log('[FFmpeg] Loading…')
  onProgress?.({ status: 'loading-ffmpeg', message: 'Loading FFmpeg engine…', progress: 0 })

  const ffmpeg = new FFmpeg()
  ffmpeg.on('log', ({ type, message }) => console.log(`[FFmpeg:${type}]`, message))

  let loaded = false
  for (const base of CDN_BASES) {
    try {
      console.log('[FFmpeg] Trying:', base)
      const coreURL = await withTimeout(
        toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        WASM_LOAD_TIMEOUT_MS, 'core JS'
      )
      const wasmURL = await withTimeout(
        toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
        WASM_LOAD_TIMEOUT_MS, 'core WASM'
      )
      await withTimeout(ffmpeg.load({ coreURL, wasmURL }), WASM_LOAD_TIMEOUT_MS, 'ffmpeg.load')
      console.log('[FFmpeg] Loaded from:', base)
      loaded = true
      break
    } catch (err) {
      console.warn('[FFmpeg] Failed CDN:', base, err)
    }
  }

  if (!loaded) {
    throw new Error(
      'Failed to load FFmpeg from all CDNs. Check your internet connection and that COOP/COEP headers are set on the server.'
    )
  }

  ffmpegInstance = ffmpeg
  isLoaded = true
  return ffmpeg
}

// ─── getVideoMetadata ─────────────────────────────────────────────────────────

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
      reject(new Error(`Metadata timeout. readyState=${video.readyState} networkState=${video.networkState}`))
    }, METADATA_TIMEOUT_MS)

    function cleanup() {
      clearTimeout(timer)
      video.onloadedmetadata = null
      video.onerror = null
      URL.revokeObjectURL(url)
    }

    video.onloadedmetadata = () => {
      console.log('[Metadata] duration:', video.duration, 'size:', video.videoWidth, 'x', video.videoHeight)
      if (!video.duration || !isFinite(video.duration)) {
        cleanup()
        reject(new Error('Invalid video duration: ' + video.duration))
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

// ─── extractFrames ────────────────────────────────────────────────────────────

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
  console.log('[Extract] File size in memory:', fileData.length, 'bytes')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await ffmpeg.writeFile(inputFilename, fileData as any)
  console.log('[Extract] writeFile OK')

  if (signal?.aborted) throw new Error('Cancelled')

  const { duration } = metadata
  const frames: ExtractedFrame[] = []
  const interval = duration / TOTAL_FRAMES

  console.log(`[Extract] duration=${duration}s, interval=${interval.toFixed(4)}s`)

  // Extract frames ONE AT A TIME using -ss seek + -vframes 1
  // This is the most compatible approach for FFmpeg WASM — avoids the fps
  // filter graph entirely, which is what causes "memory access out of bounds"
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    if (signal?.aborted) throw new Error('Cancelled')

    const timestamp = i * interval
    // Seek to timestamp, grab exactly 1 frame
    const outFile = `frame_${String(i + 1).padStart(2, '0')}.jpg`

    const args = [
      '-ss', timestamp.toFixed(4),
      '-i', inputFilename,
      '-vframes', '1',
      '-q:v', '2',
      '-f', 'image2',
      outFile,
    ]

    try {
      await ffmpeg.exec(args)
    } catch (err) {
      console.warn(`[Extract] Frame ${i + 1} exec failed:`, err)
      // Continue — don't abort the whole job for one frame
    }

    // Read the output file
    try {
      const data = await ffmpeg.readFile(outFile)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uint8 = new Uint8Array((data as any).buffer ?? data)
      const blob = new Blob([uint8], { type: 'image/jpeg' })
      frames.push({
        id: i + 1,
        frameNumber: i + 1,
        timestamp,
        dataUrl: URL.createObjectURL(blob),
        width: metadata.width,
        height: metadata.height,
        blob,
      })
      await ffmpeg.deleteFile(outFile)
    } catch {
      console.warn(`[Extract] Frame ${i + 1} read failed`)
    }

    const progress = 10 + Math.floor(((i + 1) / TOTAL_FRAMES) * 88)
    onProgress({
      status: 'extracting',
      progress,
      currentFrame: i + 1,
      totalFrames: TOTAL_FRAMES,
      message: `Extracting frame ${i + 1} of ${TOTAL_FRAMES}…`,
    })
  }

  // Cleanup input
  try { await ffmpeg.deleteFile(inputFilename) } catch { /* ignore */ }

  if (frames.length === 0) {
    throw new Error(
      'FFmpeg produced 0 frames. The video codec may be unsupported. Try converting to MP4/H.264 first.'
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
