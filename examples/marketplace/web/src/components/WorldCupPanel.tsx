/** Renders a txline-edge delivery: the de-margined 1X2 odds board + the LLM value call. */
interface Edge {
  service: string
  fixtureId?: string | number
  market?: { names?: string[]; pct?: string[] }
  analysis?: unknown
}

const LABEL: Record<string, string> = { part1: 'Home', draw: 'Draw', part2: 'Away' }

/** The seller's `analysis` may be an object, a JSON string {call, confidence}, or plain prose. */
function parseAnalysis(a: unknown): { call?: string; confidence?: number } {
  if (a && typeof a === 'object') return a as { call?: string; confidence?: number }
  if (typeof a === 'string') {
    try {
      const o = JSON.parse(a)
      return o && typeof o === 'object' ? o : { call: a }
    } catch {
      return { call: a }
    }
  }
  return {}
}

export function WorldCupPanel({ edge }: { edge: Edge }) {
  const names = edge.market?.names ?? []
  const pct = edge.market?.pct ?? []
  const { call, confidence } = parseAnalysis(edge.analysis)
  return (
    <div className="wc-panel" data-testid="wc-edge">
      <div className="wc-head">⚽ World Cup edge · fixture {edge.fixtureId}</div>
      {names.length > 0 && (
        <div className="wc-odds">
          {names.map((name, i) => {
            const p = Number(pct[i])
            return (
              <div className="wc-row" key={name}>
                <span className="wc-sel">{LABEL[name] ?? name}</span>
                <span className="wc-pct">{Number.isFinite(p) ? `${p.toFixed(0)}%` : '—'}</span>
                <div className="wc-bar"><div className="wc-fill" style={{ width: `${Math.min(100, Number.isFinite(p) ? p : 0)}%` }} /></div>
              </div>
            )
          })}
        </div>
      )}
      {call && (
        <p className="wc-call">
          <strong>call:</strong> {call}
          {confidence != null && <span className="wc-conf"> · {Math.round(Number(confidence) * 100)}% conf</span>}
        </p>
      )}
    </div>
  )
}
