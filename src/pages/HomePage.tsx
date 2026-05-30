import { useFrameExtractor } from '../hooks/useFrameExtractor'
import { UploadZone } from '../components/UploadZone'
import { VideoInfo } from '../components/VideoInfo'
import { ProcessingPanel } from '../components/ProcessingPanel'
import { FrameGallery } from '../components/FrameGallery'
import { ErrorPanel } from '../components/ErrorPanel'

export function HomePage() {
  const {
    videoFile,
    metadata,
    frames,
    processing,
    validationError,
    selectVideo,
    startExtraction,
    cancelExtraction,
    reset,
  } = useFrameExtractor()

  const isProcessing =
    processing.status !== 'idle' &&
    processing.status !== 'complete' &&
    processing.status !== 'error'

  const showUpload = !videoFile || !!validationError
  const showVideoInfo = !!metadata && !isProcessing && processing.status !== 'complete' && processing.status !== 'error'
  const showProcessing = isProcessing
  const showGallery = processing.status === 'complete' && frames.length > 0
  const showError = processing.status === 'error'

  return (
    <main className="flex-1 w-full max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero text — only shown on upload screen */}
      {showUpload && (
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-gold-dim border border-accent-gold/20 mb-5">
            <div className="w-1 h-1 rounded-full bg-accent-gold animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-accent-gold">
              50 Frames · Exact · High Quality
            </span>
          </div>
          <h2 className="font-display font-800 text-4xl sm:text-5xl text-text-primary leading-tight tracking-tight mb-3">
            Extract any frame<br />
            <span className="text-accent-gold">from any video</span>
          </h2>
          <p className="font-body text-base text-text-muted max-w-md mx-auto leading-relaxed">
            Upload a video and instantly get 50 evenly-distributed JPEG frames
            at full resolution. Runs entirely in your browser.
          </p>
        </div>
      )}

      {/* Gallery header when showing results */}
      {showGallery && (
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-5 rounded-full bg-accent-gold" />
            <h2 className="font-display font-700 text-2xl text-text-primary">Extracted Frames</h2>
          </div>
          <p className="font-mono text-xs text-text-muted pl-4">
            50 frames · {metadata?.name} · Click any frame to preview
          </p>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col items-center gap-6">
        {showUpload && (
          <UploadZone
            onFileSelect={selectVideo}
            error={validationError}
            disabled={isProcessing}
          />
        )}

        {showVideoInfo && metadata && (
          <VideoInfo
            metadata={metadata}
            onExtract={startExtraction}
            isProcessing={isProcessing}
          />
        )}

        {showProcessing && (
          <ProcessingPanel
            state={processing}
            onCancel={cancelExtraction}
          />
        )}

        {showError && (
          <ErrorPanel
            message={processing.error ?? 'Unknown error'}
            onRetry={startExtraction}
            onReset={reset}
          />
        )}

        {showGallery && metadata && (
          <FrameGallery
            frames={frames}
            videoName={metadata.name}
            onReset={reset}
          />
        )}
      </div>

      {/* Features strip — only on upload screen */}
      {showUpload && (
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
          {[
            {
              title: 'Exact 50 Frames',
              desc: 'Algorithmically distributed across the full duration at equal intervals.',
            },
            {
              title: '100% Private',
              desc: 'Powered by FFmpeg WASM. Your video never leaves your device.',
            },
            {
              title: '4K Ready',
              desc: 'Handles any resolution. Frames preserve original dimensions.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-card bg-bg-surface border border-border-subtle p-5"
            >
              <h3 className="font-display font-600 text-sm text-text-primary mb-1.5">{f.title}</h3>
              <p className="font-body text-xs text-text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
