import { useState } from 'react'
import { useFeed, startMarket } from './api'
import { MarketView } from './components/MarketView'
import { Explainer } from './components/Explainer'

/** Read ?session=<id> from the URL so the launcher can deep-link straight to a live market. */
const initialSession = new URLSearchParams(window.location.search).get('session') ?? ''

// A plausible base58 Solana mint address (32–44 chars) — gates the "check" button client-side.
const isMintLike = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim())

export default function App() {
  const [session, setSession] = useState(initialSession)
  const [mint, setMint] = useState('')
  const [starting, setStarting] = useState(false)
  const [startErr, setStartErr] = useState<string>()
  const { rounds, connected, error } = useFeed(session)

  async function launch(withMint?: string) {
    setStarting(true)
    setStartErr(undefined)
    try {
      const id = await startMarket(withMint)
      setSession(id)
      const url = new URL(window.location.href)
      url.searchParams.set('session', id)
      window.history.replaceState({}, '', url)
    } catch (e) {
      setStartErr((e as Error).message)
    } finally {
      setStarting(false)
    }
  }
  const onCheckToken = () => { if (isMintLike(mint)) void launch(mint.trim()) }

  return (
    <div className="app">
      <header className="app-head">
        <h1>RugGuard</h1>
        <span className="sub">AI agents buy a token rug-check · settled trustlessly on Solana</span>
        <span className={`dot ${connected ? 'dot-on' : 'dot-off'}`} data-testid="conn" title={connected ? 'connected' : (error ?? 'disconnected')} />
      </header>

      {/* Primary action: screen any Solana token the user pastes in. */}
      <div className="check-bar">
        <input
          aria-label="token mint address"
          placeholder="paste any Solana token address to rug-check…"
          value={mint}
          onChange={(e) => setMint(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCheckToken() }}
        />
        <button onClick={onCheckToken} disabled={starting || !isMintLike(mint)} data-testid="check-token">
          {starting ? 'checking…' : 'Rug-check this token'}
        </button>
      </div>
      <p className="check-hint">
        e.g. BONK <code>DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263</code> · or
        {' '}<button className="linklike" onClick={() => void launch()} disabled={starting}>run the default demo</button>
        {' '}· paste a session id to revisit:&nbsp;
        <input
          className="session-inline"
          aria-label="session id"
          placeholder="session id…"
          value={session}
          onChange={(e) => setSession(e.target.value.trim())}
        />
      </p>
      {startErr && <p className="start-err" data-testid="start-err">{startErr}</p>}

      <Explainer />

      <main>
        {session ? <MarketView rounds={rounds} /> : (
          <p className="empty">Paste a token address above and <strong>Rug-check this token</strong> — agents bid, verify on-chain, and settle live.</p>
        )}
      </main>
    </div>
  )
}
