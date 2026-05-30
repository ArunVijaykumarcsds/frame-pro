export const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
  'video/avi',
  'video/mkv',
]

export const SUPPORTED_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv']

export const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024 * 1024 // 4 GB

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateVideoFile(file: File): ValidationResult {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  const isValidType = SUPPORTED_VIDEO_TYPES.includes(file.type) || SUPPORTED_EXTENSIONS.includes(ext)

  if (!isValidType) {
    return {
      valid: false,
      error: `Unsupported format. Please use: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'File exceeds the 4 GB size limit.',
    }
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File appears to be empty.',
    }
  }

  return { valid: true }
}
