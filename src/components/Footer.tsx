export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border-subtle px-6 py-5">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Frame<span className="text-accent-gold">Pro</span>
          </span>
          <span className="text-border font-mono text-xs">·</span>
          <span className="font-mono text-[10px] text-text-muted">
            Browser-based · No uploads · No servers
          </span>
        </div>

        <div className="flex items-center gap-4">
          {['FFmpeg WASM', 'React', 'TypeScript', 'Vite'].map((tech) => (
            <span key={tech} className="font-mono text-[9px] uppercase tracking-widest text-text-muted/60">
              {tech}
            </span>
          ))}
        </div>
      </div>
    </footer>
  )
}
