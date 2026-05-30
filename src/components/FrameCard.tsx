import { useState, useCallback } from 'react'
import { Download, Expand } from 'lucide-react'
import type { ExtractedFrame } from '../types'
import { formatTimestamp } from '../utils/format'

interface FrameCardProps {
  frame: ExtractedFrame
  videoName: string
  onDownload: (frame: ExtractedFrame) => void
  onPreview: (frame: ExtractedFrame) => void
  style?: React.CSSProperties
}

export function FrameCard({ frame, onDownload, onPreview, style }: FrameCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false)

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDownload(frame)
    },
    [frame, onDownload]
  )

  const handlePreview = useCallback(() => {
    onPreview(frame)
  }, [frame, onPreview])

  return (
    <article
      className="group relative rounded-card bg-bg-surface border border-border overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer animate-scale-in"
      onClick={handlePreview}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`Frame ${frame.frameNumber} at ${formatTimestamp(frame.timestamp)}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePreview() }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-bg-elevated overflow-hidden">
        {!imgLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-bg-elevated via-bg-hover to-bg-elevated animate-shimmer bg-[length:200%_100%]" />
        )}
        <img
          src={frame.dataUrl}
          alt={`Frame ${frame.frameNumber}`}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          className={[
            'w-full h-full object-cover transition-all duration-300',
            imgLoaded ? 'opacity-100' : 'opacity-0',
            'group-hover:scale-[1.03]',
          ].join(' ')}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Expand className="w-6 h-6 text-white drop-shadow-lg" />
          </div>
        </div>

        {/* Frame number badge */}
        <div className="absolute top-2 left-2 font-mono text-[10px] text-text-primary bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
          #{String(frame.frameNumber).padStart(2, '0')}
        </div>
      </div>

      {/* Metadata footer */}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-accent-gold-light truncate">
            {formatTimestamp(frame.timestamp)}
          </p>
          {frame.width > 0 && (
            <p className="font-mono text-[10px] text-text-muted">
              {frame.width}×{frame.height}
            </p>
          )}
        </div>

        {/* Download button */}
        <button
          onClick={handleDownload}
          className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-bg-elevated border border-border hover:border-accent-gold/40 hover:bg-accent-gold-dim hover:text-accent-gold text-text-muted transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold/60"
          aria-label={`Download frame ${frame.frameNumber}`}
          title="Download frame"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
    </article>
  )
}
