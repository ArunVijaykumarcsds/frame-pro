import { useState, useCallback } from 'react'
import { Download, Archive, RotateCcw, CheckCircle, Loader2 } from 'lucide-react'
import type { ExtractedFrame } from '../types'
import { FrameCard } from './FrameCard'
import { FramePreviewModal } from './FramePreviewModal'
import { useDownload } from '../hooks/useDownload'

interface FrameGalleryProps {
  frames: ExtractedFrame[]
  videoName: string
  onReset: () => void
}

export function FrameGallery({ frames, videoName, onReset }: FrameGalleryProps) {
  const [previewFrame, setPreviewFrame] = useState<ExtractedFrame | null>(null)
  const { isZipping, zipProgress, downloadFrame, downloadAll } = useDownload()

  const handleDownloadAll = useCallback(() => {
    downloadAll(frames, videoName)
  }, [frames, videoName, downloadAll])

  const handleDownloadFrame = useCallback(
    (frame: ExtractedFrame) => {
      downloadFrame(frame, videoName)
    },
    [videoName, downloadFrame]
  )

  return (
    <>
      <section className="w-full animate-fade-in" aria-label="Extracted frames gallery">
        {/* Results header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-status-success flex-shrink-0" />
            <div>
              <h2 className="font-display font-700 text-lg text-text-primary">
                {frames.length} Frames Extracted
              </h2>
              <p className="font-mono text-xs text-text-muted mt-0.5">
                from <span className="text-text-secondary">{videoName}</span>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl font-body text-sm text-text-muted bg-bg-surface border border-border hover:border-border-strong hover:text-text-secondary transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/40"
              aria-label="Upload a new video"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New Video
            </button>

            <button
              onClick={handleDownloadAll}
              disabled={isZipping}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-xl font-body text-sm font-500 transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60',
                isZipping
                  ? 'bg-bg-elevated border border-border text-text-muted cursor-not-allowed'
                  : 'bg-accent-gold text-bg-base hover:bg-accent-gold-light shadow-glow hover:shadow-glow-strong active:scale-[0.98]',
              ].join(' ')}
              aria-label="Download all frames as ZIP"
            >
              {isZipping ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {zipProgress > 0 ? `${zipProgress}%` : 'Compressing…'}
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5" />
                  Download All ZIP
                </>
              )}
            </button>
          </div>
        </div>

        {/* Frame grid */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          role="list"
          aria-label="Frame thumbnails"
        >
          {frames.map((frame, index) => (
            <div key={frame.id} role="listitem">
              <FrameCard
                frame={frame}
                videoName={videoName}
                onDownload={handleDownloadFrame}
                onPreview={setPreviewFrame}
                style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}
              />
            </div>
          ))}
        </div>

        {/* Bottom download CTA */}
        {frames.length > 0 && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="w-full max-w-md h-px bg-border-subtle" />
            <button
              onClick={handleDownloadAll}
              disabled={isZipping}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl font-display font-600 text-sm tracking-wide bg-bg-surface border border-border hover:border-accent-gold/40 hover:bg-accent-gold-dim text-text-primary hover:text-accent-gold-light transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/40"
            >
              <Download className="w-4 h-4" />
              Download All {frames.length} Frames as ZIP
            </button>
            <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest">
              JPEG · Original Resolution · Evenly Distributed
            </p>
          </div>
        )}
      </section>

      {/* Lightbox modal */}
      {previewFrame && (
        <FramePreviewModal
          frame={previewFrame}
          frames={frames}
          videoName={videoName}
          onClose={() => setPreviewFrame(null)}
          onDownload={handleDownloadFrame}
          onNavigate={setPreviewFrame}
        />
      )}
    </>
  )
}
