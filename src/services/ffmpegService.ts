import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { ExtractedFrame, VideoMetadata, ProcessingState } from '../types'
import { getFrameFilename } from '../utils/format'

const TOTAL_FRAMES = 50

let ffmpegInstance: FFmpeg | null = null
let isLoaded = false

/**
 * Load FFmpeg WASM (singleton – load once, reuse)
 */
export async function loadFFmpeg(
  onProgress?: (state: Partial<ProcessingState>) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) return ffmpegInstance

  onProgress?.({ status: 'loading-ffmpeg', message: 'Loading FFmpeg engine…', progress: 0 })

  const ffmpeg = new FFmpeg()

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  ffmpegInstance = ffmpeg
  isLoaded = true
  return ffmpeg
}

/**
 * Get video metadata (duration, resolution) using the browser's native video element
 */
export function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      if (!video.duration || !isFinite(video.duration)) {
        reject(new Error('Could not determine video duration. The file may be corrupted.'))
        return
      }
      resolve({
        name: file.name,
        size: file.size,
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        type: file.type || 'video/mp4',
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to read video metadata. The file may be corrupted or unsupported.'))
    }

    video.src = url
  })
}

/**
 * Extract exactly 50 frames from a video file using FFmpeg WASM
 */
export async function extractFrames(
  file: File,
  metadata: VideoMetadata,
  onProgress: (state: Partial<ProcessingState>) => void,
  signal?: AbortSignal
): Promise<ExtractedFrame[]> {
  const ffmpeg = await loadFFmpeg(onProgress)

  if (signal?.aborted) throw new Error('Operation cancelled')

  onProgress({ status: 'analyzing', message: 'Preparing video for extraction…', progress: 5 })

  // Write source video to FFmpeg virtual FS
  const inputFilename = 'input_video' + getExtension(file.name)
  const fileData = await fetchFile(file)
  await ffmpeg.writeFile(inputFilename, fileData)

  if (signal?.aborted) throw new Error('Operation cancelled')

  const { duration, width, height } = metadata

  // Calculate the fps needed to get exactly 50 frames over the full duration
  const fps = TOTAL_FRAMES / duration

  onProgress({
    status: 'extracting',
    message: `Extracting ${TOTAL_FRAMES} frames…`,
    progress: 10,
    totalFrames: TOTAL_FRAMES,
    currentFrame: 0,
  })

  // Set up FFmpeg progress tracking
  ffmpeg.on('progress', ({ progress }) => {
    if (signal?.aborted) return
    const extractionProgress = 10 + Math.floor(progress * 80)
    const currentFrame = Math.floor(progress * TOTAL_FRAMES)
    onProgress({
      status: 'extracting',
      progress: extractionProgress,
      currentFrame,
      message: `Extracting frame ${currentFrame} of ${TOTAL_FRAMES}…`,
    })
  })

  // Run FFmpeg extraction: output frame_%02d.jpg
  await ffmpeg.exec([
    '-i', inputFilename,
    '-vf', `fps=${fps}`,
    '-frames:v', String(TOTAL_FRAMES),
    '-q:v', '2', // highest quality JPEG (1-31, lower = better)
    '-vf', `fps=${fps},scale=${width}:${height}`,
    'frame_%02d.jpg',
  ])

  if (signal?.aborted) throw new Error('Operation cancelled')

  onProgress({ status: 'extracting', message: 'Reading extracted frames…', progress: 92 })

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

      // Clean up from virtual FS immediately to save memory
      await ffmpeg.deleteFile(filename)
    } catch {
      // If a frame file is missing, skip it gracefully
      console.warn(`Frame ${i} not found, skipping`)
    }

    onProgress({
      status: 'extracting',
      progress: 92 + Math.floor((i / TOTAL_FRAMES) * 7),
      currentFrame: i,
      message: `Loading frame ${i} of ${TOTAL_FRAMES}…`,
    })
  }

  // Clean up input file
  try {
    await ffmpeg.deleteFile(inputFilename)
  } catch {
    // ignore cleanup errors
  }

  // Remove ffmpeg progress listener
  ffmpeg.off('progress', () => {})

  onProgress({
    status: 'complete',
    progress: 100,
    currentFrame: frames.length,
    totalFrames: frames.length,
    message: `Successfully extracted ${frames.length} frames`,
  })

  return frames
}

/**
 * Free object URLs for extracted frames to prevent memory leaks
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

/**
 * Generate download filename for a single frame
 */
export function getDownloadFilename(videoName: string, frameNumber: number): string {
  return getFrameFilename(videoName, frameNumber)
}
