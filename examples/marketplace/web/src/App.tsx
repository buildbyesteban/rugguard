import { useState } from 'react'
import { useFeed } from './api'
import { MarketView } from './components/MarketView'

/** Read ?session=<id> from the URL so the launcher can deep-link straight to a live market. */
const initialSession = new URLSearchParams(window.location.search).get('session') ?? ''

export default function App() {
  const [session, setSession] = useState(initialSession)
  const { rounds, connected, error } = useFeed(session)

  return (
    <div className="app">
      <header className="app-head">
        <h1>The Agent Marketplace</h1>
        <span className="sub">LLM agents compete on CoralOS · settled by Solana escrow</span>
        <span className={`dot ${connected ? 'dot-on' : 'dot-off'}`} data-testid="conn" title={connected ? 'connected' : (error ?? 'disconnected')} />
      </header>

      <form className="session-bar" onSubmit={(e) => e.preventDefault()}>
        <input
          aria-label="session id"
          placeholder="paste the market session id…"
          value={session}
          onChange={(e) => setSession(e.target.value.trim())}
        />
      </form>

      <main>
        <MarketView rounds={rounds} />
      </main>
    </div>
  )
}
