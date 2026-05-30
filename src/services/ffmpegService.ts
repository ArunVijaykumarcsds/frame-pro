import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { ExtractedFrame, VideoMetadata, ProcessingState } from '../types'
import { getFrameFilename } from '../utils/format'

const TOTAL_FRAMES = 50
const METADATA_TIMEOUT_MS = 15_000
const WASM_LOAD_TIMEOUT_MS = 30_000

let ffmpegInstance: FFmpeg | null = null
let isLoaded = false

// ─── CDN list – tried in order until one works ────────────────────────────────
const CDN_BASES = [
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
]

async function loadFromCDN(base: string): Promise<{ coreURL: string; wasmURL: string }> {
  console.log('[FFmpeg] Trying CDN:', base)
  const coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript')
  console.log('[FFmpeg] core JS blob ready')
  const wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm')
  console.log('[FFmpeg] WASM blob ready')
  return { coreURL, wasmURL }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000}s`))
    }, ms)
    promise.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) }
    )
  })
}

// ─── loadFFmpeg ───────────────────────────────────────────────────────────────

export async function loadFFmpeg(
  onProgress?: (state: Partial<ProcessingState>) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) {
    console.log('[FFmpeg] Reusing loaded instance')
    return ffmpegInstance
  }

  console.log('[FFmpeg] Loading engine…')
  onProgress?.({ status: 'loading-ffmpeg', message: 'Loading FFmpeg engine…', progress: 0 })

  const ffmpeg = new FFmpeg()
  ffmpeg.on('log', ({ type, message }) => console.log(`[FFmpeg:${type}]`, message))

  // Try each CDN with a hard timeout
  let urls: { coreURL: string; wasmURL: string } | null = null
  for (const base of CDN_BASES) {
    try {
      urls = await withTimeout(loadFromCDN(base), WASM_LOAD_TIMEOUT_MS, `CDN fetch (${base})`)
      break
    } catch (err) {
      console.warn('[FFmpeg] CDN failed, trying next:', err)
    }
  }

  if (!urls) {
    throw new Error(
      'Failed to download FFmpeg WASM from all CDNs. ' +
      'Check your internet connection. If on a corporate/school network, ' +
      'jsdelivr.net or unpkg.com may be blocked.'
    )
  }

  console.log('[FFmpeg] Calling ffmpeg.load()…')
  onProgress?.({ message: 'Initialising FFmpeg engine…', progress: 3 })

  try {
    await withTimeout(ffmpeg.load(urls), WASM_LOAD_TIMEOUT_MS, 'ffmpeg.load()')
    console.log('[FFmpeg] ffmpeg.load() complete ✓')
  } catch (err) {
    console.error('[FFmpeg] ffmpeg.load() failed:', err)
    throw new Error(
      'FFmpeg WASM initialisation failed. ' +
      'This site requires Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers. ' +
      'On Render, ensure render.yaml has the correct headers block. Error: ' + String(err)
    )
  }

  ffmpegInstance = ffmpeg
  isLoaded = true
  return ffmpeg
}

// ─── getVideoMetadata ─────────────────────────────────────────────────────────

export function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    console.log('[Metadata] File:', file.name, file.size, 'bytes, type:', file.type)
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'

    const timer = setTimeout(() => {
      console.error('[Metadata] TIMEOUT – readyState:', video.readyState, 'networkState:', video.networkState)
      cleanup()
      reject(new Error(
        `Video metadata timed out after 15s. readyState=${video.readyState}, networkState=${video.networkState}. ` +
        'Try a different file or format (MP4/H.264 works best).'
      ))
    }, METADATA_TIMEOUT_MS)

    function cleanup() {
      clearTimeout(timer)
      video.onloadedmetadata = null
      video.onerror = null
      URL.revokeObjectURL(url)
    }

    video.onloadedmetadata = () => {
      console.log('[Metadata] ✓ duration:', video.duration, 'size:', video.videoWidth, '×', video.videoHeight)
      if (!video.duration || !isFinite(video.duration)) {
        cleanup()
        reject(new Error('Video duration is invalid (' + video.duration + '). File may be corrupted.'))
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
      const code = video.error?.code ?? '?'
      const msg = video.error?.message ?? 'unknown'
      console.error('[Metadata] video.onerror code:', code, msg)
      cleanup()
      reject(new Error(`Browser could not read video (MediaError ${code}: ${msg}). Try MP4/H.264 format.`))
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
  console.log('[Extract] Starting:', file.name, metadata)

  const ffmpeg = await loadFFmpeg(onProgress)
  if (signal?.aborted) throw new Error('Cancelled')

  onProgress({ status: 'analyzing', message: 'Preparing video…', progress: 5 })

  const inputFilename = 'input_video' + getExtension(file.name)

  console.log('[Extract] fetchFile…')
  const fileData = await fetchFile(file)
  console.log('[Extract] fetchFile done, bytes:', fileData.length)

  console.log('[Extract] writeFile →', inputFilename)
  try {
    await ffmpeg.writeFile(inputFilename, fileData)
    console.log('[Extract] writeFile ✓')
  } catch (err) {
    throw new Error('Failed to write video to FFmpeg virtual FS: ' + String(err))
  }

  if (signal?.aborted) throw new Error('Cancelled')

  const { duration, width, height } = metadata
  const fps = TOTAL_FRAMES / duration

  console.log(`[Extract] fps=${fps.toFixed(6)}, resolution=${width}×${height}`)

  onProgress({ status: 'extracting', message: `Extracting ${TOTAL_FRAMES} frames…`, progress: 10, totalFrames: TOTAL_FRAMES, currentFrame: 0 })

  const progressHandler = ({ progress }: { progress: number }) => {
    if (signal?.aborted) return
    const pct = 10 + Math.floor(Math.min(progress, 1) * 80)
    const cur = Math.floor(Math.min(progress, 1) * TOTAL_FRAMES)
    onProgress({ status: 'extracting', progress: pct, currentFrame: cur, message: `Extracting frame ${cur} of ${TOTAL_FRAMES}…` })
  }
  ffmpeg.on('progress', progressHandler)

  // Single -vf flag (was duplicated before — that caused silent failure)
  const vfFilter = (width > 0 && height > 0)
    ? `fps=${fps},scale=${width}:${height}`
    : `fps=${fps}`

  const args = ['-i', inputFilename, '-vf', vfFilter, '-frames:v', String(TOTAL_FRAMES), '-q:v', '2', 'frame_%02d.jpg']
  console.log('[Extract] ffmpeg.exec:', args.join(' '))

  try {
    await ffmpeg.exec(args)
    console.log('[Extract] ffmpeg.exec ✓')
  } catch (err) {
    ffmpeg.off('progress', progressHandler)
    throw new Error('FFmpeg exec failed: ' + String(err))
  }

  ffmpeg.off('progress', progressHandler)
  if (signal?.aborted) throw new Error('Cancelled')

  onProgress({ status: 'extracting', message: 'Reading frames…', progress: 92 })

  const frames: ExtractedFrame[] = []
  const secondsPerFrame = duration / TOTAL_FRAMES

  for (let i = 1; i <= TOTAL_FRAMES; i++) {
    if (signal?.aborted) throw new Error('Cancelled')
    const filename = `frame_${String(i).padStart(2, '0')}.jpg`
    try {
      const data = await ffmpeg.readFile(filename)
      const blob = new Blob([data], { type: 'image/jpeg' })
      frames.push({
        id: i,
        frameNumber: i,
        timestamp: (i - 1) * secondsPerFrame,
        dataUrl: URL.createObjectURL(blob),
        width,
        height,
        blob,
      })
      await ffmpeg.deleteFile(filename)
    } catch {
      console.warn('[Extract] Missing frame', i)
    }
    onProgress({ status: 'extracting', progress: 92 + Math.floor((i / TOTAL_FRAMES) * 7), currentFrame: i, message: `Loading frame ${i} of ${TOTAL_FRAMES}…` })
  }

  try { await ffmpeg.deleteFile(inputFilename) } catch { /* ignore */ }

  if (frames.length === 0) {
    throw new Error('FFmpeg ran but produced 0 frames. The codec may be unsupported or the file is corrupted.')
  }

  console.log(`[Extract] Done – ${frames.length} frames`)
  onProgress({ status: 'complete', progress: 100, currentFrame: frames.length, totalFrames: frames.length, message: `Extracted ${frames.length} frames` })

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
