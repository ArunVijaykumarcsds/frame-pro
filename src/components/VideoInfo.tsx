import { Clock, Maximize, HardDrive, Film, Play } from 'lucide-react'
import type { VideoMetadata } from '../types'
import { formatDuration, formatFileSize } from '../utils/format'

interface VideoInfoProps {
  metadata: VideoMetadata
  onExtract: () => void
  isProcessing: boolean
}

export function VideoInfo({ metadata, onExtract, isProcessing }: VideoInfoProps) {
  return (
    <div className="w-full max-w-2xl mx-auto animate-slide-up">
      <div className="rounded-card bg-bg-surface border border-border shadow-card overflow-hidden">
        {/* Header bar */}
        <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
          <Film className="w-3.5 h-3.5 text-accent-gold" strokeWidth={2} />
          <span className="font-mono text-xs text-text-muted uppercase tracking-widest">Video Loaded</span>
        </div>

        <div className="p-5">
          {/* Filename */}
          <p className="font-display font-600 text-base text-text-primary truncate mb-4" title={metadata.name}>
            {metadata.name}
          </p>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <MetaStat
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Duration"
              value={formatDuration(metadata.duration)}
            />
            <MetaStat
              icon={<Maximize className="w-3.5 h-3.5" />}
              label="Resolution"
              value={metadata.width > 0 ? `${metadata.width}×${metadata.height}` : 'Unknown'}
            />
            <MetaStat
              icon={<HardDrive className="w-3.5 h-3.5" />}
              label="File Size"
              value={formatFileSize(metadata.size)}
            />
            <MetaStat
              icon={<Film className="w-3.5 h-3.5" />}
              label="Frames"
              value="50"
              highlight
            />
          </div>

          {/* Extract button */}
          <button
            onClick={onExtract}
            disabled={isProcessing}
            className={[
              'w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-display font-600 text-sm tracking-wide transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
              isProcessing
                ? 'bg-bg-elevated border border-border text-text-muted cursor-not-allowed'
                : 'bg-accent-gold hover:bg-accent-gold-light text-bg-base shadow-glow hover:shadow-glow-strong active:scale-[0.98]',
            ].join(' ')}
            aria-label="Start frame extraction"
          >
            <Play className="w-4 h-4" strokeWidth={2.5} />
            {isProcessing ? 'Extracting…' : 'Extract 50 Frames'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface MetaStatProps {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}

function MetaStat({ icon, label, value, highlight }: MetaStatProps) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-bg-elevated border border-border-subtle">
      <div className={`flex items-center gap-1.5 ${highlight ? 'text-accent-gold' : 'text-text-muted'}`}>
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <span className={`font-mono text-sm font-500 ${highlight ? 'text-accent-gold-light' : 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  )
}
