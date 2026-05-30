import JSZip from 'jszip'
import type { ExtractedFrame } from '../types'
import { getFrameFilename, sanitizeFilename } from '../utils/format'

/**
 * Download a single frame as JPEG
 */
export function downloadSingleFrame(frame: ExtractedFrame, videoName: string): void {
  const filename = getFrameFilename(videoName, frame.frameNumber)
  const url = URL.createObjectURL(frame.blob)
  triggerDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * Download all frames as a ZIP archive
 */
export async function downloadAllFramesAsZip(
  frames: ExtractedFrame[],
  videoName: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const zip = new JSZip()
  const folderName = sanitizeFilename(videoName) + '_frames'
  const folder = zip.folder(folderName)!

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const filename = getFrameFilename(videoName, frame.frameNumber)
    const arrayBuffer = await frame.blob.arrayBuffer()
    folder.file(filename, arrayBuffer)
    onProgress?.(Math.floor(((i + 1) / frames.length) * 80))
  }

  onProgress?.(85)
  const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } }, (meta) => {
    onProgress?.(85 + Math.floor(meta.percent * 0.15))
  })

  const zipFilename = `${sanitizeFilename(videoName)}_frames.zip`
  const url = URL.createObjectURL(content)
  triggerDownload(url, zipFilename)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  onProgress?.(100)
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
