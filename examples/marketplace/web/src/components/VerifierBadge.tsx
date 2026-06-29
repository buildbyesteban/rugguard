import type { Round } from '../types'
import { explorerTx } from '../types'

/**
 * The independent verifier's verdict on a delivery: did re-reading the chain confirm the seller's
 * report? Shows CONFIRMED/REJECTED, the reason, and (on a confirm) the on-chain fee the buyer paid
 * the verifier — the second settlement that makes this a graph of agents, not a pair.
 */
export function VerifierBadge({ round }: { round: Round }) {
  if (!round.verdict && round.status !== 'verifying') return null
  if (!round.verdict) {
    return <div className="vf vf-pending" data-testid="verifier">🛡️ verifier re-checking on-chain…</div>
  }
  const { ok, note } = round.verdict
  return (
    <div className={`vf ${ok ? 'vf-ok' : 'vf-bad'}`} data-testid="verifier">
      <span className="vf-title">🛡️ {ok ? 'VERIFIED ✓' : 'REJECTED ✗'}</span>
      {note && <span className="vf-note">{note}</span>}
      {round.verifierPaid && (
        <a className="vf-fee" href={explorerTx(round.verifierPaid.sig)} target="_blank" rel="noreferrer">
          verifier paid ↗
        </a>
      )}
    </div>
  )
}
