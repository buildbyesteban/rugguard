import { describe, it, expect } from 'vitest'
import { foldRounds, type RawMessage } from './foldRounds.js'

const sellers = ['seller-cheap', 'seller-premium', 'seller-lazy']

// A full happy-path round, verbatim from a real devnet run (sigs truncated).
const round1: RawMessage[] = [
  { sender: 'buyer-agent', text: 'WANT round=1 service=coingecko arg=SOL-USDC budget=0.001' },
  { sender: 'seller-premium', text: 'BID round=1 price=0.0005 by=seller-premium note=available' },
  { sender: 'seller-cheap', text: 'BID round=1 price=0.0002 by=seller-cheap note=available' },
  { sender: 'buyer-agent', text: 'AWARD round=1 to=seller-premium reason="verified data worth the premium"' },
  { sender: 'seller-premium', text: 'ESCROW_REQUIRED round=1 reference=DKQy seller=7jwB amount=0.0005 deadline=600' },
  { sender: 'buyer-agent', text: 'DEPOSITED round=1 reference=DKQy buyer=47Dp sig=5syz' },
  { sender: 'seller-premium', text: 'DELIVERED round=1 {"coin":"solana","usd":72.33}' },
  { sender: 'buyer-agent', text: 'RELEASED round=1 sig=3PMa' },
]

describe('foldRounds', () => {
  it('folds a full round to settled with parsed fields', () => {
    const [r] = foldRounds(round1, sellers)
    expect(r.round).toBe(1)
    expect(r.want).toEqual({ service: 'coingecko', arg: 'SOL-USDC', budgetSol: 0.001 })
    expect(r.bids).toHaveLength(2)
    expect(r.award).toEqual({ to: 'seller-premium', reason: 'verified data worth the premium' })
    expect(r.escrow?.amountSol).toBe(0.0005)
    expect(r.deposit?.sig).toBe('5syz')
    expect(r.delivered?.data).toEqual({ coin: 'solana', usd: 72.33 })
    expect(r.release?.sig).toBe('3PMa')
    expect(r.status).toBe('settled')
  })

  it('marks the non-bidding seller as declined (self-selection)', () => {
    const [r] = foldRounds(round1, sellers)
    expect(r.declined).toEqual(['seller-lazy']) // only cheap + premium bid on coingecko
  })

  it('dedupes a seller that bids twice (last write kept by first-wins guard)', () => {
    const msgs: RawMessage[] = [
      { sender: 'buyer-agent', text: 'WANT round=2 service=coingecko arg=x budget=0.001' },
      { sender: 'seller-cheap', text: 'BID round=2 price=0.0002 by=seller-cheap' },
      { sender: 'seller-cheap', text: 'BID round=2 price=0.0003 by=seller-cheap' },
    ]
    expect(foldRounds(msgs).find((r) => r.round === 2)?.bids).toHaveLength(1)
  })

  it('handles a refund-after-deadline round', () => {
    const msgs: RawMessage[] = [
      { sender: 'buyer-agent', text: 'WANT round=3 service=coingecko arg=x budget=0.001' },
      { sender: 'seller-cheap', text: 'BID round=3 price=0.0002 by=seller-cheap' },
      { sender: 'buyer-agent', text: 'AWARD round=3 to=seller-cheap' },
      { sender: 'buyer-agent', text: 'REFUNDED round=3' },
    ]
    expect(foldRounds(msgs).find((r) => r.round === 3)?.status).toBe('refunded')
  })

  it('separates interleaved rounds and sorts ascending', () => {
    const msgs: RawMessage[] = [
      { sender: 'b', text: 'WANT round=2 service=s arg=a budget=0.001' },
      { sender: 'b', text: 'WANT round=1 service=s arg=a budget=0.001' },
      { sender: 'c', text: 'BID round=1 price=0.0002 by=c' },
      { sender: 'c', text: 'BID round=2 price=0.0003 by=c' },
    ]
    const rounds = foldRounds(msgs)
    expect(rounds.map((r) => r.round)).toEqual([1, 2])
  })

  it('leaves an in-progress round in a non-settled status', () => {
    const r = foldRounds(round1.slice(0, 3), sellers)[0]
    expect(r.status).toBe('bidding')
    expect(r.declined).toEqual([]) // bidding still open → not yet declined
  })

  // ── rug-check verification leg ──────────────────────────────────────────────
  const report = JSON.stringify({ service: 'rugcheck', mint: 'DezX', risk: { score: 10, level: 'LOOKS OK' } })
  const rugBase: RawMessage[] = [
    { sender: 'buyer-agent', text: 'WANT round=5 service=rugcheck arg=DezX budget=0.001' },
    { sender: 'seller-scanner', text: 'BID round=5 price=0.0002 by=seller-scanner' },
    { sender: 'buyer-agent', text: 'AWARD round=5 to=seller-scanner' },
    { sender: 'seller-scanner', text: 'ESCROW_REQUIRED round=5 reference=R5 seller=7jwB amount=0.0002 deadline=600' },
    { sender: 'buyer-agent', text: 'DEPOSITED round=5 reference=R5 buyer=47Dp sig=dep5' },
    { sender: 'seller-scanner', text: `DELIVERED round=5 ${report}` },
    { sender: 'buyer-agent', text: `VERIFY round=5 seller=seller-scanner report=${Buffer.from(report).toString('base64')}` },
  ]

  it('confirmed verdict → release + verifier fee, status settled', () => {
    const msgs: RawMessage[] = [
      ...rugBase,
      { sender: 'verifier-agent', text: 'VERIFIED round=5 ok=true seller=seller-scanner note=on-chain facts confirmed' },
      { sender: 'buyer-agent', text: 'RELEASED round=5 sig=rel5' },
      { sender: 'buyer-agent', text: 'VERIFIER_PAID round=5 sig=fee5' },
    ]
    const r = foldRounds(msgs, ['seller-scanner', 'seller-auditor']).find((x) => x.round === 5)!
    expect(r.verdict).toEqual({ ok: true, seller: 'seller-scanner', note: 'on-chain facts confirmed' })
    expect(r.verifierPaid?.sig).toBe('fee5')
    expect(r.release?.sig).toBe('rel5')
    expect(r.status).toBe('settled')
  })

  it('failed verdict → rejected, no release', () => {
    const msgs: RawMessage[] = [
      ...rugBase,
      { sender: 'verifier-agent', text: 'VERIFIED round=5 ok=false seller=seller-scanner note=mintAuthorityRenounced mismatch' },
      { sender: 'seller-scanner', text: 'WITHHELD round=5 reason=verification-failed' },
    ]
    const r = foldRounds(msgs).find((x) => x.round === 5)!
    expect(r.verdict?.ok).toBe(false)
    expect(r.status).toBe('rejected')
    expect(r.release).toBeUndefined()
  })
})
