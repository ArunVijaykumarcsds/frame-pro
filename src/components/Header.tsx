import { Film } from 'lucide-react'

export function Header() {
  return (
    <header className="relative z-10 px-6 py-5 flex items-center justify-between border-b border-border-subtle">
      <div className="flex items-center gap-3">
        {/* Logo mark */}
        <div className="relative flex items-center justify-center w-9 h-9">
          <div className="absolute inset-0 rounded-lg bg-accent-gold-dim border border-accent-gold/20" />
          <Film className="relative w-4.5 h-4.5 text-accent-gold" strokeWidth={1.5} />
        </div>

        <div>
          <h1 className="font-display font-700 text-sm tracking-[0.12em] text-text-primary uppercase">
            Frame<span className="text-accent-gold">Pro</span>
          </h1>
          <p className="font-mono text-[10px] text-text-muted tracking-widest uppercase leading-none mt-0.5">
            Frame Extraction Engine
          </p>
        </div>
      </div>

      <nav className="hidden md:flex items-center gap-6">
        <span className="font-body text-xs text-text-muted tracking-wide">
          50 Frames · Browser-Based · Zero Upload
        </span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
          <span className="font-mono text-xs text-status-success">Ready</span>
        </div>
      </nav>
    </header>
  )
}
