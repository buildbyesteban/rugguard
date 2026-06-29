/**
 * Verifier agent — the independent arbiter of the rug-check market. It turns a buyer↔seller PAIR into
 * a GRAPH: an oracle paid to verify another agent's work before money is released.
 *
 * Flow (over the shared CoralOS `market` thread):
 *   seller → buyer:    DELIVERED round=… {rugcheck report, incl. raw on-chain `facts`}
 *   buyer  → verifier: VERIFY round=… seller=… report=<base64>     ("check this delivery")
 *   verifier:          INDEPENDENTLY re-reads the same mint from the chain and compares
 *   verifier → buyer:  VERIFIED round=… ok=true|false seller=… note=…
 *
 * The buyer gates `release()` on `ok=true`. The verifier NEVER trusts the seller's numbers — it
 * re-fetches the chain itself (the source of truth) — so a seller can't be paid for a fabricated
 * report. On `ok=true` the buyer pays the verifier a small flat fee on-chain (see buyer-agent).
 *
 * This agent moves NO value and holds no keypair; it only reads mainnet (read-only) and posts a
 * verdict. Settlement stays with the buyer + the escrow contract.
 *
 * Env: AGENT_NAME (market identity), RUGCHECK_RPC_URL (mainnet read RPC), TRACE=1.
 */
import {
  startCoralAgent, parseVerifyRequest, formatVerdict,
  fetchTokenFacts, scoreFacts, factsMatch, type TokenFacts,
} from '@pay/agent-runtime'

const NAME = process.env.AGENT_NAME ?? 'verifier-agent'
const RPC = process.env.RUGCHECK_RPC_URL || undefined
const trace = process.env.TRACE === '1'

await startCoralAgent({ agentName: NAME }, async (ctx) => {
  console.error(`[${NAME}] independent rug-check verifier ready — re-reads every delivery from the chain`)

  while (true) {
    try {
      const m = await ctx.waitForMention()
      if (!m) continue
      const req = parseVerifyRequest(m.text.trim())
      if (!req) continue // not a VERIFY — ignore

      const reject = (note: string) =>
        ctx.reply(m, formatVerdict({ round: req.round, ok: false, seller: req.seller, note }))

      // Parse the seller's delivered report.
      let report: {
        service?: string; mint?: string; error?: string
        risk?: { level?: string; score?: number }; facts?: TokenFacts
      }
      try { report = JSON.parse(req.report) } catch { await reject('unparseable report'); continue }

      if (report.service !== 'rugcheck' || !report.mint || !report.facts) {
        await reject('not a rug-check report'); continue
      }
      if (report.error) { await reject(`seller reported an error: ${String(report.error).slice(0, 40)}`); continue }

      // The crux: re-read the SAME mint from the chain ourselves. Never trust the seller's `facts`.
      let chain: TokenFacts
      try { chain = await fetchTokenFacts(report.mint, RPC) }
      catch (e) { await reject(`verifier could not read the chain: ${(e as Error).message.slice(0, 40)}`); continue }

      const match = factsMatch(report.facts, chain)        // do the claimed facts match the chain?
      const rescore = scoreFacts(chain)                    // re-derive the risk independently
      const claimedLevel = report.risk?.level
      const levelOk = !claimedLevel || claimedLevel === rescore.level

      const ok = match.ok && levelOk
      const note = ok
        ? `on-chain facts confirmed — ${rescore.level} (score ${rescore.score})`
        : [...match.diffs, ...(levelOk ? [] : [`level seller=${claimedLevel} chain=${rescore.level}`])]
            .join('; ').slice(0, 140) || 'mismatch'

      if (trace) console.error(`[${NAME}] round ${req.round} ${req.seller}: ok=${ok} — ${note}`)
      await ctx.reply(m, formatVerdict({ round: req.round, ok, seller: req.seller, note }))
    } catch (e) {
      console.error(`[${NAME}] loop error: ${e}`)
    }
  }
})
