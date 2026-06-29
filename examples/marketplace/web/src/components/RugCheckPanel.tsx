/** Renders a `rugcheck` delivery: the token, a risk gauge, the LLM verdict, and the on-chain signals. */
interface RugReport {
  service: string
  mint?: string
  risk?: { score?: number; level?: string }
  verdict?: string
  signals?: string[]
  facts?: {
    mintAuthorityRenounced?: boolean
    freezeAuthorityRenounced?: boolean
    topHolderPct?: number
    top10Pct?: number
    uiSupply?: number
    holderSample?: number
  }
  error?: string
}

const short = (s?: string) => (s && s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s ?? '')
const levelClass = (level?: string) =>
  level === 'HIGH RISK' ? 'rc-high' : level === 'CAUTION' ? 'rc-caution' : 'rc-ok'

function Flag({ ok, label }: { ok?: boolean; label: string }) {
  if (ok == null) return null
  return (
    <span className={`rc-flag ${ok ? 'rc-flag-ok' : 'rc-flag-bad'}`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  )
}

export function RugCheckPanel({ report }: { report: RugReport }) {
  if (report.error) {
    return <div className="rc-panel rc-err" data-testid="rugcheck">⚠️ {report.error}</div>
  }
  const score = report.risk?.score ?? 0
  const level = report.risk?.level ?? '—'
  const f = report.facts ?? {}
  return (
    <div className="rc-panel" data-testid="rugcheck">
      <div className="rc-head">
        <span className="rc-token">🔍 {short(report.mint)}</span>
        <span className={`rc-level ${levelClass(level)}`}>{level}</span>
        <span className="rc-score">{score}<span className="rc-score-max">/100</span></span>
      </div>

      <div className="rc-gauge">
        <div className={`rc-gauge-fill ${levelClass(level)}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>

      {report.verdict && <p className="rc-verdict">{report.verdict}</p>}

      <div className="rc-flags">
        <Flag ok={f.mintAuthorityRenounced} label="mint renounced" />
        <Flag ok={f.freezeAuthorityRenounced} label="freeze renounced" />
        {f.holderSample ? (
          <span className="rc-flag rc-flag-info">top holder {f.topHolderPct ?? 0}%</span>
        ) : null}
      </div>

      {report.signals && report.signals.length > 0 && (
        <ul className="rc-signals">
          {report.signals.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      )}
    </div>
  )
}
