/**
 * TxODDS service — a drop-in `deliverService()` for the seller agent.
 *
 * This is the fork point: it turns verified TxLINE World Cup data into the *good* an agent sells for
 * devnet SOL. Wire it into the seller by adding a `txline` case in
 * `coral-agents/seller-agent/src/service.ts`:
 *
 *     import { deliverTxOdds } from '../../examples/txodds/agent/service.js'
 *     case 'txline': return deliverTxOdds(payload)
 *
 * Request grammar (the buyer's request string after the `txline` keyword):
 *   "fixtures"          -> upcoming World Cup / Int Friendlies fixtures              (data only)
 *   "odds <fixtureId>"  -> de-margined StablePrice odds for a fixture                (data only)
 *   "edge <fixtureId>"  -> odds + an LLM value call                                  (all three pillars)
 *
 * Pillars in play:
 *   - CoralOS  carries this string in/out (it's the DELIVERED payload) — handled by the runtime.
 *   - Solana   gates delivery: the seller only calls this after the escrow PDA is funded.
 *   - LLM      turns raw odds into a sellable insight in the `edge` verb (`complete()` from the kit).
 */
import { TxLineClient } from './txline.js'
import { complete } from '@pay/agent-runtime'

export async function deliverTxOdds(request: string): Promise<string> {
  const [verb = 'fixtures', ...rest] = request.trim().split(/\s+/)
  const client = new TxLineClient()

  try {
    switch (verb.toLowerCase()) {
      case 'fixtures': {
        const fixtures = await client.fixtures()
        return JSON.stringify({
          service: 'txline-fixtures',
          count: fixtures.length,
          fixtures: fixtures.slice(0, 10),
          timestamp: new Date().toISOString(),
        })
      }

      case 'odds': {
        const fixtureId = Number(rest[0])
        if (!fixtureId) return JSON.stringify({ error: 'usage: odds <fixtureId>' })
        const odds = await client.odds(fixtureId)
        return JSON.stringify({ service: 'txline-odds', fixtureId, odds, timestamp: new Date().toISOString() })
      }

      // The on-thesis product: verified data in, LLM-shaped insight out, paid in SOL.
      case 'edge': {
        const fixtureId = Number(rest[0])
        if (!fixtureId) return JSON.stringify({ error: 'usage: edge <fixtureId>' })
        const odds = await client.odds(fixtureId)
        const analysis = await complete({
          system:
            'You are a disciplined football trading analyst. Given de-margined World Cup odds, ' +
            'state any value edge and a single one-line call. Be concise; never invent data.',
          user: `Fixture ${fixtureId} odds: ${JSON.stringify(odds).slice(0, 1500)}`,
          maxTokens: 256,
        })
        return JSON.stringify({
          service: 'txline-edge',
          fixtureId,
          analysis,
          timestamp: new Date().toISOString(),
        })
      }

      default:
        return JSON.stringify({ error: `unknown txline verb: ${verb} (try: fixtures | odds | edge)` })
    }
  } catch (e) {
    // Match the kit convention: failures come back as a string the buyer can read, not a throw.
    return JSON.stringify({ error: `txline delivery failed: ${(e as Error).message}` })
  }
}
