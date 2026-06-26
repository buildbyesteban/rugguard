/**
 * Marketplace feed server — the only backend the visualizer needs.
 *
 * Reads a CoralOS session's transcript (extended state, behind the dev token), folds it into typed
 * market rounds with `foldRounds`, and serves it as CORS-enabled JSON for the React app to poll. The
 * browser never touches coral or Solana — this keeps the token server-side and avoids CORS.
 *
 *   GET /api/health                  → { ok: true }
 *   GET /api/feed?session=<sid>      → { rounds, updatedAt }   (session defaults to $SESSION)
 *
 * Env: CORAL_SERVER_URL (default http://localhost:5555), CORAL_TOKEN (default dev),
 *      SESSION (default session id), MARKET_SELLERS (csv for the declined column), PORT (default 4000).
 */
import express from 'express'
import { foldRounds, type RawMessage } from './foldRounds.js'

const BASE = process.env.CORAL_SERVER_URL ?? 'http://localhost:5555'
const TOKEN = process.env.CORAL_TOKEN ?? 'dev'
const NS = 'default'
const PORT = Number(process.env.PORT ?? 4000)
const DEFAULT_SESSION = process.env.SESSION ?? ''
const SELLERS = (process.env.MARKET_SELLERS ?? 'seller-cheap,seller-premium,seller-lazy')
  .split(',').map((s) => s.trim()).filter(Boolean)

/** Walk CoralOS extended state for thread messages → {sender, text}. Defensive about shape. */
export function collectMessages(state: unknown): RawMessage[] {
  const out: RawMessage[] = []
  const root = state as Record<string, unknown>
  const threads = (root?.threads ?? (root?.session as Record<string, unknown>)?.threads) as
    | Array<Record<string, unknown>>
    | undefined
  for (const thread of threads ?? []) {
    for (const m of (thread.messages as Array<Record<string, unknown>>) ?? []) {
      const sender = (m.senderName ?? m.sender ?? m.senderId ?? 'unknown') as string
      const text = (m.text ?? m.content ?? '') as string
      if (text) out.push({ sender, text })
    }
  }
  return out
}

const app = express()
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  next()
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.get('/api/feed', async (req, res) => {
  const session = (req.query.session as string) || DEFAULT_SESSION
  if (!session) return res.status(400).json({ error: 'no session — pass ?session=<id> or set SESSION' })
  try {
    const r = await fetch(`${BASE}/api/v1/local/session/${NS}/${session}/extended`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    if (!r.ok) return res.status(502).json({ error: `coral ${r.status}`, detail: (await r.text()).slice(0, 200) })
    const rounds = foldRounds(collectMessages(await r.json()), SELLERS)
    res.json({ session, rounds, updatedAt: new Date().toISOString() })
  } catch (e) {
    res.status(502).json({ error: `feed failed: ${(e as Error).message}` })
  }
})

app.listen(PORT, () => console.error(`[feed] http://localhost:${PORT}/api/feed  (coral=${BASE})`))
