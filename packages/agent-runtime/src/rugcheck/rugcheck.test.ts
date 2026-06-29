import { describe, it, expect } from 'vitest'
import { scoreFacts, factsMatch, type TokenFacts } from './rugcheck.js'

// Pure (network-free) tests for the rug-check scorer + the verifier's comparison. The on-chain
// fetch (fetchTokenFacts) hits live RPC, so it's exercised in the live market, not here.

const base: TokenFacts = {
  mint: 'So11111111111111111111111111111111111111112',
  exists: true, decimals: 9, supply: '1000000000000000', uiSupply: 1_000_000,
  mintAuthorityRenounced: true, freezeAuthorityRenounced: true,
  topHolderPct: 5, top10Pct: 30, holderSample: 20,
}

describe('scoreFacts', () => {
  it('a clean token (authorities renounced, spread out) reads LOOKS OK', () => {
    const r = scoreFacts(base)
    expect(r.level).toBe('LOOKS OK')
    expect(r.score).toBeLessThan(30)
  })

  it('an active mint authority is a high-weight risk', () => {
    const r = scoreFacts({ ...base, mintAuthorityRenounced: false })
    expect(r.score).toBeGreaterThanOrEqual(35)
    expect(r.signals.join(' ')).toMatch(/mint authority/i)
  })

  it('mint + freeze authority + whale concentration stacks to HIGH RISK', () => {
    const r = scoreFacts({ ...base, mintAuthorityRenounced: false, freezeAuthorityRenounced: false, topHolderPct: 60, top10Pct: 90 })
    expect(r.level).toBe('HIGH RISK')
    expect(r.score).toBeGreaterThanOrEqual(55)
  })

  it('a non-existent mint is maximally risky', () => {
    const r = scoreFacts({ ...base, exists: false })
    expect(r.score).toBe(100)
    expect(r.level).toBe('HIGH RISK')
  })

  it('always appends the not-financial-advice caveat', () => {
    expect(scoreFacts(base).signals.join(' ')).toMatch(/not financial advice/i)
  })
})

describe('factsMatch (verifier)', () => {
  it('identical facts agree', () => {
    expect(factsMatch(base, base).ok).toBe(true)
  })

  it('catches a seller lying about a renounced mint authority', () => {
    const lie = { ...base, mintAuthorityRenounced: true }       // seller claims safe…
    const chain = { ...base, mintAuthorityRenounced: false }    // …chain says authority is live
    const r = factsMatch(lie, chain)
    expect(r.ok).toBe(false)
    expect(r.diffs.join(' ')).toMatch(/mintAuthorityRenounced/)
  })

  it('tolerates small holder-% drift between two RPC reads', () => {
    expect(factsMatch(base, { ...base, topHolderPct: 8 }).ok).toBe(true)   // 3% drift, within tolerance
    expect(factsMatch(base, { ...base, topHolderPct: 20 }).ok).toBe(false) // 15% drift, flagged
  })
})
