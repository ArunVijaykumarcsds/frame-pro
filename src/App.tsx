import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { HomePage } from './pages/HomePage'

export default function App() {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col relative overflow-x-hidden">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(201,168,76,0.06) 0%, transparent 70%)',
        }}
      />

      <Header />
      <HomePage />
      <Footer />
    </div>
  )
}
