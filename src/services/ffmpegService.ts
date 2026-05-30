import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { ExtractedFrame, VideoMetadata, ProcessingState } from '../types'
import { getFrameFilename } from '../utils/format'

const TOTAL_FRAMES = 50
const METADATA_TIMEOUT_MS = 15_000

let ffmpegInstance: FFmpeg | null = null
let isLoaded = false

// ─── 1. loadFFmpeg ────────────────────────────────────────────────────────────

/**
 * Load FFmpeg WASM (singleton – load once, reuse).
 * Logs every major step so network/WASM failures are visible in the console.
 */
export async function loadFFmpeg(
  onProgress?: (state: Partial<ProcessingState>) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) {
    console.log('[FFmpeg] Already loaded – reusing singleton')
    return ffmpegInstance
  }

  console.log('[FFmpeg] Starting load…')
  onProgress?.({ status: 'loading-ffmpeg', message: 'Loading FFmpeg engine…', progress: 0 })

  const ffmpeg = new FFmpeg()

  // Mirror ffmpeg internal log to the browser console
  ffmpeg.on('log', ({ type, message }) => {
    console.log(`[FFmpeg log:${type}]`, message)
  })

  // Use the jsdelivr CDN which is more reliable than unpkg for large WASM files
  // and does not require SharedArrayBuffer for the core JS itself.
  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm'

  console.log('[FFmpeg] Fetching core JS from:', `${baseURL}/ffmpeg-core.js`)
  console.log('[FFmpeg] Fetching WASM from:   ', `${baseURL}/ffmpeg-core.wasm`)

  try {
    const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
    console.log('[FFmpeg] core JS blob URL ready:', coreURL.slice(0, 60))

    const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    console.log('[FFmpeg] WASM blob URL ready:   ', wasmURL.slice(0, 60))

    await ffmpeg.load({ coreURL, wasmURL })
    console.log('[FFmpeg] ffmpeg.load() resolved – engine is ready')
  } catch (err) {
    console.error('[FFmpeg] Failed to load FFmpeg WASM:', err)
    throw new Error(
      'Failed to load the FFmpeg engine. Check your internet connection and that ' +
      'the site is served with Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy headers.'
    )
  }

  ffmpegInstance = ffmpeg
  isLoaded = true
  return ffmpeg
}

// ─── 2. getVideoMetadata ──────────────────────────────────────────────────────

/**
 * Get video duration + resolution via a native <video> element.
 *
 * Brave (and other privacy-focused browsers) sometimes block
 * onloadedmetadata when the video codec is unsupported, or when
 * the browser's media pipeline stalls.  We defend against that with:
 *   - an explicit video.load() call after setting src
 *   - a 15-second hard timeout
 *   - detailed console logging at every decision point
 */
export function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    console.log('[Metadata] Creating object URL for:', file.name, `(${file.size} bytes, type="${file.type}")`)
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')

    // Essential for Brave / Firefox: muted + playsInline prevents autoplay
    // policies from blocking the media pipeline entirely.
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous'

    // ── 15-second timeout ──────────────────────────────────────────────────
    const timer = setTimeout(() => {
      console.error('[Metadata] TIMEOUT – onloadedmetadata did not fire within 15 s')
      console.error('[Metadata] readyState at timeout:', video.readyState,
        '(0=HAVE_NOTHING,1=HAVE_METADATA,2=HAVE_CURRENT_DATA,3=HAVE_FUTURE_DATA,4=HAVE_ENOUGH_DATA)')
      console.error('[Metadata] networkState at timeout:', video.networkState,
        '(0=EMPTY,1=IDLE,2=LOADING,3=NO_SOURCE)')
      cleanup()
      reject(new Error(
        'Video metadata timed out after 15 seconds. ' +
        'The browser may not support this codec, or the file may be corrupted. ' +
        `readyState=${video.readyState}, networkState=${video.networkState}`
      ))
    }, METADATA_TIMEOUT_MS)

    function cleanup() {
      clearTimeout(timer)
      video.onloadedmetadata = null
      video.onerror = null
      video.oncanplay = null
      URL.revokeObjectURL(url)
    }

    // ── Success ────────────────────────────────────────────────────────────
    video.onloadedmetadata = () => {
      console.log('[Metadata] onloadedmetadata fired ✓')
      console.log('[Metadata] duration:', video.duration, 's')
      console.log('[Metadata] videoWidth:', video.videoWidth, '  videoHeight:', video.videoHeight)
      console.log('[Metadata] readyState:', video.readyState)

      if (!video.duration || !isFinite(video.duration)) {
        cleanup()
        reject(new Error(
          'Could not determine video duration (got: ' + video.duration + '). ' +
          'The file may be corrupted or use an unsupported container.'
        ))
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

    // ── Fallback: some browsers fire canplay before loadedmetadata ─────────
    video.oncanplay = () => {
      console.log('[Metadata] oncanplay fired (fallback check)')
      if (video.readyState >= 1 && video.duration && isFinite(video.duration)) {
        console.log('[Metadata] Resolving from oncanplay fallback')
        video.onloadedmetadata?.(new Event('loadedmetadata'))
      }
    }

    // ── Error ──────────────────────────────────────────────────────────────
    video.onerror = (e) => {
      const code = (video.error?.code ?? 'unknown')
      const msg  = (video.error?.message ?? String(e))
      console.error('[Metadata] video.onerror – code:', code, 'message:', msg)
      cleanup()
      reject(new Error(
        `Browser rejected the video file (MediaError code ${code}: ${msg}). ` +
        'Try a different format (MP4/H.264 is best supported).'
      ))
    }

    // ── Assign src and explicitly call load() ──────────────────────────────
    console.log('[Metadata] Setting video.src and calling video.load()')
    video.src = url
    video.load() // required in some browsers to start the pipeline
  })
}

// ─── 3. extractFrames ─────────────────────────────────────────────────────────

/**
 * Extract exactly 50 frames from a video file using FFmpeg WASM.
 */
export async function extractFrames(
  file: File,
  metadata: VideoMetadata,
  onProgress: (state: Partial<ProcessingState>) => void,
  signal?: AbortSignal
): Promise<ExtractedFrame[]> {
  console.log('[Extract] Starting extraction for:', file.name)
  console.log('[Extract] metadata:', metadata)

  const ffmpeg = await loadFFmpeg(onProgress)

  if (signal?.aborted) throw new Error('Operation cancelled')

  onProgress({ status: 'analyzing', message: 'Preparing video for extraction…', progress: 5 })

  // ── Write input file to FFmpeg virtual FS ──────────────────────────────
  const inputFilename = 'input_video' + getExtension(file.name)
  console.log('[Extract] Fetching file data for writeFile…')
  const fileData = await fetchFile(file)
  console.log('[Extract] fileData length:', fileData.length, 'bytes')

  console.log('[Extract] ffmpeg.writeFile() →', inputFilename)
  try {
    await ffmpeg.writeFile(inputFilename, fileData)
    console.log('[Extract] writeFile() complete ✓')
  } catch (err) {
    console.error('[Extract] writeFile() FAILED:', err)
    throw new Error('Failed to write video to FFmpeg virtual filesystem: ' + String(err))
  }

  if (signal?.aborted) throw new Error('Operation cancelled')

  const { duration, width, height } = metadata

  // fps = 50 / total_seconds → exactly 50 frames over full duration
  const fps = TOTAL_FRAMES / duration
  console.log(`[Extract] duration=${duration}s  fps=${fps.toFixed(6)}  expecting ${TOTAL_FRAMES} frames`)
  console.log(`[Extract] resolution: ${width}×${height}`)

  onProgress({
    status: 'extracting',
    message: `Extracting ${TOTAL_FRAMES} frames…`,
    progress: 10,
    totalFrames: TOTAL_FRAMES,
    currentFrame: 0,
  })

  // ── FFmpeg progress listener ───────────────────────────────────────────
  const progressHandler = ({ progress }: { progress: number }) => {
    if (signal?.aborted) return
    const pct = 10 + Math.floor(Math.min(progress, 1) * 80)
    const currentFrame = Math.floor(Math.min(progress, 1) * TOTAL_FRAMES)
    onProgress({
      status: 'extracting',
      progress: pct,
      currentFrame,
      message: `Extracting frame ${currentFrame} of ${TOTAL_FRAMES}…`,
    })
  }
  ffmpeg.on('progress', progressHandler)

  // ── Build FFmpeg args ─────────────────────────────────────────────────
  // FIX: removed the duplicate -vf flag that caused FFmpeg to error/silently
  // fail. Only one -vf filter chain is allowed.  If width/height are unknown
  // (0) we skip the scale filter to avoid a "0×0" error.
  const vfFilter = (width > 0 && height > 0)
    ? `fps=${fps},scale=${width}:${height}`
    : `fps=${fps}`

  const ffmpegArgs = [
    '-i', inputFilename,
    '-vf', vfFilter,
    '-frames:v', String(TOTAL_FRAMES),
    '-q:v', '2',            // near-max JPEG quality (1–31, lower = better)
    'frame_%02d.jpg',
  ]

  console.log('[Extract] ffmpeg.exec() args:', ffmpegArgs.join(' '))

  try {
    await ffmpeg.exec(ffmpegArgs)
    console.log('[Extract] ffmpeg.exec() complete ✓')
  } catch (err) {
    console.error('[Extract] ffmpeg.exec() FAILED:', err)
    ffmpeg.off('progress', progressHandler)
    throw new Error('FFmpeg frame extraction failed: ' + String(err))
  }

  ffmpeg.off('progress', progressHandler)

  if (signal?.aborted) throw new Error('Operation cancelled')

  onProgress({ status: 'extracting', message: 'Reading extracted frames…', progress: 92 })

  // ── Read output frames ────────────────────────────────────────────────
  const frames: ExtractedFrame[] = []
  const secondsPerFrame = duration / TOTAL_FRAMES

  for (let i = 1; i <= TOTAL_FRAMES; i++) {
    if (signal?.aborted) throw new Error('Operation cancelled')

    const filename = `frame_${String(i).padStart(2, '0')}.jpg`

    try {
      const data = await ffmpeg.readFile(filename)
      const blob = new Blob([data], { type: 'image/jpeg' })
      const dataUrl = URL.createObjectURL(blob)

      frames.push({
        id: i,
        frameNumber: i,
        timestamp: (i - 1) * secondsPerFrame,
        dataUrl,
        width,
        height,
        blob,
      })

      await ffmpeg.deleteFile(filename)
    } catch (err) {
      console.warn(`[Extract] Frame ${i} (${filename}) not found – skipping:`, err)
    }

    onProgress({
      status: 'extracting',
      progress: 92 + Math.floor((i / TOTAL_FRAMES) * 7),
      currentFrame: i,
      message: `Loading frame ${i} of ${TOTAL_FRAMES}…`,
    })
  }

  console.log(`[Extract] ${frames.length} frames loaded`)

  // ── Cleanup input ─────────────────────────────────────────────────────
  try {
    await ffmpeg.deleteFile(inputFilename)
  } catch {
    // ignore cleanup errors
  }

  if (frames.length === 0) {
    throw new Error(
      'FFmpeg ran but produced no output frames. ' +
      'The video codec may be unsupported by FFmpeg WASM, or the file is corrupted.'
    )
  }

  onProgress({
    status: 'complete',
    progress: 100,
    currentFrame: frames.length,
    totalFrames: frames.length,
    message: `Successfully extracted ${frames.length} frames`,
  })

  console.log('[Extract] Done ✓')
  return frames
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Free object URLs for extracted frames to prevent memory leaks.
 */
export function releaseFrames(frames: ExtractedFrame[]): void {
  for (const frame of frames) {
    if (frame.dataUrl.startsWith('blob:')) {
      URL.revokeObjectURL(frame.dataUrl)
    }
  }
}

function getExtension(filename: string): string {
  const parts = filename.split('.')
  if (parts.length > 1) return '.' + parts.pop()!.toLowerCase()
  return '.mp4'
}

export function getDownloadFilename(videoName: string, frameNumber: number): string {
  return getFrameFilename(videoName, frameNumber)
}
