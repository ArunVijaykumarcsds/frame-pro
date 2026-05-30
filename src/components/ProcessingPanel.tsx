import { X, Cpu, Zap } from 'lucide-react'
import type { ProcessingState } from '../types'
import { ProgressRing } from './ProgressRing'

interface ProcessingPanelProps {
  state: ProcessingState
  onCancel: () => void
}

const STATUS_LABELS: Record<string, string> = {
  'loading-ffmpeg': 'Initialising Engine',
  analyzing: 'Analysing Video',
  extracting: 'Extracting Frames',
  complete: 'Extraction Complete',
  error: 'Extraction Failed',
}

export function ProcessingPanel({ state, onCancel }: ProcessingPanelProps) {
  const isActive = state.status !== 'idle' && state.status !== 'complete' && state.status !== 'error'
  const label = STATUS_LABELS[state.status] ?? 'Processing'

  return (
    <div className="w-full max-w-2xl mx-auto animate-scale-in">
      <div className="rounded-card bg-bg-surface border border-border shadow-card overflow-hidden">
        {/* Status bar */}
        <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isActive ? (
              <Cpu className="w-3.5 h-3.5 text-accent-gold animate-pulse" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-accent-gold" />
            )}
            <span className="font-mono text-xs uppercase tracking-widest text-text-muted">{label}</span>
          </div>
          {isActive && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 font-mono text-xs text-text-muted hover:text-status-error transition-colors px-2 py-1 rounded-lg hover:bg-status-error/10"
              aria-label="Cancel extraction"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          )}
        </div>

        <div className="p-8 flex flex-col items-center gap-6">
          {/* Ring + percentage */}
          <div className="relative flex items-center justify-center">
            <ProgressRing progress={state.progress} size={128} strokeWidth={6} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display font-700 text-2xl text-text-primary tabular-nums">
                {state.progress}%
              </span>
              {state.status === 'extracting' && (
                <span className="font-mono text-[10px] text-text-muted mt-0.5">
                  {state.currentFrame}/{state.totalFrames}
                </span>
              )}
            </div>
          </div>

          {/* Status message */}
          <div className="text-center space-y-1">
            <p className="font-body text-sm text-text-secondary">{state.message}</p>
            {state.status === 'loading-ffmpeg' && (
              <p className="font-mono text-xs text-text-muted">First load may take a few seconds…</p>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 rounded-full bg-bg-elevated overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-amber to-accent-gold rounded-full transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>

          {/* Frame ticks */}
          {state.status === 'extracting' && (
            <div className="flex flex-wrap justify-center gap-1 max-w-xs">
              {Array.from({ length: 50 }, (_, i) => (
                <div
                  key={i}
                  className={[
                    'w-2 h-2 rounded-sm transition-all duration-200',
                    i < state.currentFrame
                      ? 'bg-accent-gold scale-100'
                      : 'bg-bg-elevated scale-75',
                  ].join(' ')}
                  style={{ transitionDelay: `${i * 10}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
