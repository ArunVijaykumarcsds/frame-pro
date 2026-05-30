import { useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import type { ExtractedFrame } from '../types'
import { formatTimestamp } from '../utils/format'

interface FramePreviewModalProps {
  frame: ExtractedFrame
  frames: ExtractedFrame[]
  videoName: string
  onClose: () => void
  onDownload: (frame: ExtractedFrame) => void
  onNavigate: (frame: ExtractedFrame) => void
}

export function FramePreviewModal({
  frame,
  frames,
  onClose,
  onDownload,
  onNavigate,
}: FramePreviewModalProps) {
  const currentIndex = frames.findIndex((f) => f.id === frame.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < frames.length - 1

  const navigatePrev = useCallback(() => {
    if (hasPrev) onNavigate(frames[currentIndex - 1])
  }, [hasPrev, currentIndex, frames, onNavigate])

  const navigateNext = useCallback(() => {
    if (hasNext) onNavigate(frames[currentIndex + 1])
  }, [hasNext, currentIndex, frames, onNavigate])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') navigatePrev()
      if (e.key === 'ArrowRight') navigateNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, navigatePrev, navigateNext])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview frame ${frame.frameNumber}`}
    >
      <div
        className="relative w-full max-w-5xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image container */}
        <div className="relative rounded-card overflow-hidden bg-black shadow-[0_32px_80px_rgba(0,0,0,0.8)]">
          <img
            src={frame.dataUrl}
            alt={`Frame ${frame.frameNumber}`}
            className="w-full h-auto max-h-[80vh] object-contain"
          />

          {/* Top bar */}
          <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-white/80">
                Frame <span className="text-accent-gold-light font-500">#{String(frame.frameNumber).padStart(2, '0')}</span>
              </span>
              <span className="font-mono text-xs text-white/50">·</span>
              <span className="font-mono text-xs text-white/80">{formatTimestamp(frame.timestamp)}</span>
              {frame.width > 0 && (
                <>
                  <span className="font-mono text-xs text-white/50">·</span>
                  <span className="font-mono text-xs text-white/80">{frame.width}×{frame.height}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onDownload(frame)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-gold/20 border border-accent-gold/30 text-accent-gold-light font-mono text-xs hover:bg-accent-gold/30 transition-colors"
                aria-label="Download frame"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <button
                onClick={onClose}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          {hasPrev && (
            <button
              onClick={navigatePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
              aria-label="Previous frame"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {hasNext && (
            <button
              onClick={navigateNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
              aria-label="Next frame"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Frame counter */}
        <p className="text-center font-mono text-xs text-white/40 mt-3">
          {currentIndex + 1} / {frames.length} · Press ← → to navigate · ESC to close
        </p>
      </div>
    </div>
  )
}
