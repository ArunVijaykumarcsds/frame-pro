import { useRef, useCallback } from 'react'
import { Upload, Film, AlertCircle } from 'lucide-react'
import { useDropZone } from '../hooks/useDropZone'
import { SUPPORTED_EXTENSIONS } from '../utils/validation'

interface UploadZoneProps {
  onFileSelect: (file: File) => void
  error?: string | null
  disabled?: boolean
}

export function UploadZone({ onFileSelect, error, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const { isDragging, dropZoneProps } = useDropZone({
    onDrop: onFileSelect,
    accept: ['video/', ...SUPPORTED_EXTENSIONS],
  })

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click()
  }, [disabled])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onFileSelect(file)
      // Reset input so same file can be re-selected
      e.target.value = ''
    },
    [onFileSelect]
  )

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      <div
        {...dropZoneProps}
        onClick={handleClick}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload video file"
        aria-disabled={disabled}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
        className={[
          'relative group cursor-pointer rounded-card border-2 border-dashed transition-all duration-300 overflow-hidden',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
          isDragging
            ? 'border-accent-gold bg-accent-gold-dim shadow-glow-strong scale-[1.01]'
            : 'border-border hover:border-accent-gold/50 hover:bg-bg-surface/60 hover:shadow-glow',
          disabled ? 'opacity-50 pointer-events-none' : '',
        ].join(' ')}
      >
        {/* Animated background grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Glow effect */}
        {isDragging && (
          <div className="absolute inset-0 bg-gradient-radial from-accent-gold/10 via-transparent to-transparent" />
        )}

        <div className="relative z-10 flex flex-col items-center justify-center gap-5 py-16 px-8 text-center">
          {/* Icon */}
          <div className={[
            'relative flex items-center justify-center w-20 h-20 rounded-2xl transition-all duration-300',
            isDragging
              ? 'bg-accent-gold/20 border border-accent-gold/40 scale-110'
              : 'bg-bg-elevated border border-border group-hover:border-accent-gold/30 group-hover:bg-accent-gold-dim',
          ].join(' ')}>
            {isDragging ? (
              <Film className="w-9 h-9 text-accent-gold animate-pulse" strokeWidth={1.5} />
            ) : (
              <Upload className="w-9 h-9 text-text-muted group-hover:text-accent-gold/80 transition-colors duration-300" strokeWidth={1.5} />
            )}
          </div>

          {/* Text */}
          <div className="space-y-2">
            <p className={[
              'font-display font-600 text-xl transition-colors duration-200',
              isDragging ? 'text-accent-gold-light' : 'text-text-primary',
            ].join(' ')}>
              {isDragging ? 'Drop to extract frames' : 'Drop your video here'}
            </p>
            <p className="font-body text-sm text-text-muted">
              or <span className="text-accent-gold/80 underline underline-offset-2">click to browse</span>
            </p>
          </div>

          {/* Formats */}
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {SUPPORTED_EXTENSIONS.map((ext) => (
              <span
                key={ext}
                className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-bg-elevated border border-border text-text-muted"
              >
                {ext.replace('.', '')}
              </span>
            ))}
          </div>

          <p className="font-body text-xs text-text-muted opacity-60">
            Processed entirely in your browser. Your video never leaves your device.
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-3 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-status-error/10 border border-status-error/25 animate-slide-up">
          <AlertCircle className="w-4 h-4 text-status-error mt-0.5 flex-shrink-0" />
          <p className="font-body text-sm text-status-error">{error}</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED_EXTENSIONS.map(e => `video/*,${e}`).join(',')}
        onChange={handleInputChange}
        className="sr-only"
        aria-hidden="true"
      />
    </div>
  )
}
