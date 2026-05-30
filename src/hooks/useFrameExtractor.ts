import { useState, useCallback, useRef } from 'react'
import type { VideoMetadata, ExtractedFrame, ProcessingState } from '../types'
import { getVideoMetadata, extractFrames, releaseFrames } from '../services/ffmpegService'
import { validateVideoFile } from '../utils/validation'

const INITIAL_PROCESSING_STATE: ProcessingState = {
  status: 'idle',
  progress: 0,
  currentFrame: 0,
  totalFrames: 50,
  message: '',
}

export function useFrameExtractor() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [frames, setFrames] = useState<ExtractedFrame[]>([])
  const [processing, setProcessing] = useState<ProcessingState>(INITIAL_PROCESSING_STATE)
  const [validationError, setValidationError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const updateProcessing = useCallback((update: Partial<ProcessingState>) => {
    setProcessing((prev) => ({ ...prev, ...update }))
  }, [])

  const selectVideo = useCallback(async (file: File) => {
    setValidationError(null)

    // Validate
    const validation = validateVideoFile(file)
    if (!validation.valid) {
      setValidationError(validation.error!)
      return
    }

    // Release previous frames memory
    setFrames((prev) => {
      releaseFrames(prev)
      return []
    })

    setVideoFile(file)
    setMetadata(null)
    setProcessing(INITIAL_PROCESSING_STATE)

    try {
      updateProcessing({ status: 'analyzing', message: 'Reading video metadata…', progress: 2 })
      const meta = await getVideoMetadata(file)
      setMetadata(meta)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to read video file'
      setValidationError(msg)
      setVideoFile(null)
      setProcessing(INITIAL_PROCESSING_STATE)
    }
  }, [updateProcessing])

  const startExtraction = useCallback(async () => {
    if (!videoFile || !metadata) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setFrames([])

    try {
      const extracted = await extractFrames(
        videoFile,
        metadata,
        updateProcessing,
        controller.signal
      )
      if (!controller.signal.aborted) {
        setFrames(extracted)
      }
    } catch (err) {
      if (controller.signal.aborted) return
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during extraction'
      updateProcessing({
        status: 'error',
        error: msg,
        message: msg,
      })
    }
  }, [videoFile, metadata, updateProcessing])

  const cancelExtraction = useCallback(() => {
    abortRef.current?.abort()
    updateProcessing({ status: 'idle', progress: 0, message: '', currentFrame: 0 })
  }, [updateProcessing])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    releaseFrames(frames)
    setVideoFile(null)
    setMetadata(null)
    setFrames([])
    setProcessing(INITIAL_PROCESSING_STATE)
    setValidationError(null)
  }, [frames])

  return {
    videoFile,
    metadata,
    frames,
    processing,
    validationError,
    selectVideo,
    startExtraction,
    cancelExtraction,
    reset,
  }
}
