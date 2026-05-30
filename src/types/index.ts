export interface VideoMetadata {
  name: string
  size: number
  duration: number
  width: number
  height: number
  type: string
}

export interface ExtractedFrame {
  id: number
  frameNumber: number
  timestamp: number
  dataUrl: string
  width: number
  height: number
  blob: Blob
}

export type ProcessingStatus =
  | 'idle'
  | 'loading-ffmpeg'
  | 'analyzing'
  | 'extracting'
  | 'complete'
  | 'error'

export interface ProcessingState {
  status: ProcessingStatus
  progress: number
  currentFrame: number
  totalFrames: number
  message: string
  error?: string
}

export interface DownloadOptions {
  frame?: ExtractedFrame
  frames?: ExtractedFrame[]
  videoName: string
}
