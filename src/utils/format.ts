/**
 * Format a duration in seconds to HH:MM:SS.mmm
 */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

/**
 * Format bytes to a human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Format duration in seconds to a readable string
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/**
 * Sanitize a filename for use in download naming
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/[^a-zA-Z0-9_-]/g, '_') // replace invalid chars
    .replace(/_+/g, '_') // collapse multiple underscores
    .replace(/^_|_$/g, '') // trim underscores
    .toLowerCase()
}

/**
 * Generate a frame filename based on video name and frame number
 */
export function getFrameFilename(videoName: string, frameNumber: number): string {
  const base = sanitizeFilename(videoName)
  return `${base}_frame_${String(frameNumber).padStart(2, '0')}.jpg`
}
