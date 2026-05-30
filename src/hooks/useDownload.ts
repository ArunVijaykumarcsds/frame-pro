import { useState, useCallback } from 'react'
import type { ExtractedFrame } from '../types'
import { downloadSingleFrame, downloadAllFramesAsZip } from '../services/downloadService'

export function useDownload() {
  const [isZipping, setIsZipping] = useState(false)
  const [zipProgress, setZipProgress] = useState(0)

  const downloadFrame = useCallback((frame: ExtractedFrame, videoName: string) => {
    downloadSingleFrame(frame, videoName)
  }, [])

  const downloadAll = useCallback(async (frames: ExtractedFrame[], videoName: string) => {
    if (isZipping) return
    setIsZipping(true)
    setZipProgress(0)
    try {
      await downloadAllFramesAsZip(frames, videoName, setZipProgress)
    } finally {
      setIsZipping(false)
      setZipProgress(0)
    }
  }, [isZipping])

  return {
    isZipping,
    zipProgress,
    downloadFrame,
    downloadAll,
  }
}
