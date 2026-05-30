import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorPanelProps {
  message: string
  onRetry?: () => void
  onReset?: () => void
}

export function ErrorPanel({ message, onRetry, onReset }: ErrorPanelProps) {
  return (
    <div className="w-full max-w-2xl mx-auto animate-scale-in">
      <div className="rounded-card bg-bg-surface border border-status-error/25 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-status-error/15 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-status-error" />
          <span className="font-mono text-xs uppercase tracking-widest text-status-error">Extraction Failed</span>
        </div>

        <div className="p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-status-error/10 border border-status-error/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-status-error" />
          </div>

          <div>
            <p className="font-body text-sm text-text-secondary mb-1">Something went wrong during extraction</p>
            <p className="font-mono text-xs text-text-muted bg-bg-elevated border border-border-subtle rounded-lg px-4 py-2.5 mt-3 text-left break-all">
              {message}
            </p>
          </div>

          <div className="flex items-center gap-3 mt-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-body text-sm bg-accent-gold text-bg-base hover:bg-accent-gold-light transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try Again
              </button>
            )}
            {onReset && (
              <button
                onClick={onReset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-body text-sm text-text-muted border border-border hover:border-border-strong hover:text-text-secondary transition-colors"
              >
                Upload New Video
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
