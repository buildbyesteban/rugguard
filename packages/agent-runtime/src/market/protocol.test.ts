import { describe, it, expect } from 'vitest'
import {
  formatWant, parseWant, formatBid, parseBid, formatAward, parseAward,
  formatEscrowRequired, parseEscrowRequired, formatDeposited, parseDeposited,
  formatVerifyRequest, parseVerifyRequest, formatVerdict, parseVerdict,
  selectBids, pickCheapest, verb, messageRound,
  type Bid,
} from './protocol.js'

describe('VERIFY request round-trip', () => {
  it('carries a spaces-and-symbols report through base64', () => {
    const report = JSON.stringify({ service: 'rugcheck', verdict: 'HIGH RISK: mint authority active', n: 1 })
    const v = { round: 4, seller: 'seller-scanner', report }
    expect(parseVerifyRequest(formatVerifyRequest(v))).toEqual(v)
  })
  it('rejects a non-VERIFY', () => {
    expect(parseVerifyRequest('DELIVERED round=4 {}')).toBeNull()
  })
})

describe('VERIFIED verdict round-trip', () => {
  it('formats and parses ok=true with a note', () => {
    const v = { round: 4, ok: true, seller: 'seller-auditor', note: 'on-chain facts match' }
    expect(parseVerdict(formatVerdict(v))).toEqual(v)
  })
  it('parses ok=false', () => {
    const p = parseVerdict('VERIFIED round=9 ok=false seller=seller-scanner note=mint authority mismatch')
    expect(p?.ok).toBe(false)
    expect(p?.round).toBe(9)
  })
})

describe('WANT round-trip', () => {
  it('formats and parses', () => {
    const w = { round: 7, service: 'helius-risk', arg: '7jwB', budgetSol: 0.001 }
    expect(parseWant(formatWant(w))).toEqual(w)
  })
  it('rejects a non-WANT', () => {
    expect(parseWant('BID round=7 price=0.0003 by=x')).toBeNull()
  })
})

describe('BID round-trip', () => {
  it('formats and parses with a free-text note', () => {
    const b = { round: 7, priceSol: 0.0006, by: 'seller-premium', note: 'verified, fresh pull' }
    expect(parseBid(formatBid(b))).toEqual(b)
  })
  it('parses without a note', () => {
    expect(parseBid('BID round=3 price=0.0002 by=seller-cheap')).toEqual({
      round: 3, priceSol: 0.0002, by: 'seller-cheap',
    })
  })
})

describe('AWARD + ESCROW_REQUIRED round-trip', () => {
  it('AWARD', () => {
    expect(parseAward(formatAward(9, 'seller-cheap'))).toEqual({ round: 9, to: 'seller-cheap' })
  })
  it('AWARD carries an optional reason', () => {
    const msg = formatAward(9, 'seller-cheap', 'best value')
    expect(msg).toContain('reason="best value"')
    expect(parseAward(msg)).toEqual({ round: 9, to: 'seller-cheap' })
  })
  it('ESCROW_REQUIRED', () => {
    const t = { round: 9, reference: 'R3f', seller: 'SeLLeRwa11et', amountSol: 0.0006, deadlineSecs: 600 }
    expect(parseEscrowRequired(formatEscrowRequired(t))).toEqual(t)
  })
  it('DEPOSITED', () => {
    const d = { round: 9, reference: 'R3f', buyer: 'BuYeRwa11et', sig: '5h2abc' }
    expect(parseDeposited(formatDeposited(d))).toEqual(d)
  })
})

describe('selection', () => {
  const bids: Bid[] = [
    { round: 7, priceSol: 0.0006, by: 'premium' },
    { round: 7, priceSol: 0.0003, by: 'cheap' },
    { round: 6, priceSol: 0.0001, by: 'cheap' }, // different round — excluded
    { round: 7, priceSol: 0.0002, by: 'cheap' }, // cheap re-bids; last wins
  ]
  it('selectBids filters by round and dedupes by seller (last wins)', () => {
    const r7 = selectBids(bids, 7)
    expect(r7).toHaveLength(2)
    expect(r7.find((b) => b.by === 'cheap')?.priceSol).toBe(0.0002)
  })
  it('pickCheapest picks the lowest price', () => {
    expect(pickCheapest(selectBids(bids, 7))?.by).toBe('cheap')
  })
})

describe('helpers', () => {
  it('verb + messageRound', () => {
    expect(verb('WANT round=7 ...')).toBe('WANT')
    expect(messageRound('BID round=42 price=0.1 by=x')).toBe(42)
  })
})
