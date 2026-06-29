/**
 * Buyer agent — the marketplace buyer. Broadcasts a WANT into a shared CoralOS thread, collects
 * competing LLM bids, picks the best value, and settles through the escrow contract:
 *
 *   WANT → (collect BIDs for a window) → AWARD winner → wait ESCROW_REQUIRED →
 *   deposit() into escrow → DEPOSITED → wait DELIVERED → release() to the seller
 *
 * Selection uses the LLM (best value), with a deterministic cheapest fallback so a slow/missing model
 * never hangs the round. Settlement is escrow-only — funds are conditional on delivery.
 *
 * Env: BUYER_KEYPAIR_B58 (signs), BUYER_MAX_SOL (budget), BUYER_SERVICE/BUYER_ARG (the WANT),
 *      MARKET_SELLERS (csv of seller names), BID_WINDOW_MS, SOLANA_RPC_URL,
 *      ANTHROPIC_API_KEY|OPENAI_API_KEY (+ LLM_PROVIDER), TRACE=1.
 *
 * The deposit/release calls settle against the escrow program deployed to devnet; they need a funded
 * devnet wallet + live RPC, so they run in a live market session rather than in `npm test`/CI.
 */
import {
  startCoralAgent, complete, parseJsonReply, loadKeypairB58, signTransfer,
  formatWant, parseBid, parseEscrowRequired, formatAward, formatDeposited,
  formatVerifyRequest, parseVerdict,
  selectBids, pickCheapest, verb, messageRound,
  type Bid, type EscrowTerms, type Verdict, type CoralAgentContext,
} from '@pay/agent-runtime'
import { PublicKey } from '@solana/web3.js'
import { makeProgram, deposit, release, escrowPda } from './escrow.js'
import { payoutMatches } from './guard.js'

const RPC = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const BUDGET = Number(process.env.BUYER_MAX_SOL ?? '0.001')
const SERVICE = process.env.BUYER_SERVICE ?? 'coingecko' // canonical default (matches coral-agent.toml + start.ts)
// Rotate through several args so each round trades a *different* thing (BUYER_ARGS=csv of fixture ids,
// else the single BUYER_ARG). This is what stops the market looking like the same round on a loop.
const ARGS = (process.env.BUYER_ARGS || process.env.BUYER_ARG || 'SOL-USDC').split(',').map((s) => s.trim()).filter(Boolean)
const ARG = ARGS[0]
const BID_WINDOW_MS = Number(process.env.BID_WINDOW_MS ?? '5000')
const CYCLE_MS = Number(process.env.CYCLE_INTERVAL_MS ?? '30000')
const SELLERS = (process.env.MARKET_SELLERS ?? 'seller-cheap,seller-premium')
  .split(',').map((s) => s.trim()).filter(Boolean)
// F3: the payout wallet the buyer expects (personas share one in the demo). If set, the buyer refuses
// to deposit to an ESCROW_REQUIRED whose seller= pubkey differs — binding the award to the payout.
const EXPECTED_SELLER_WALLET = process.env.SELLER_WALLET ?? ''
// Verification leg — the independent arbiter that re-checks the delivery on-chain before release.
// When VERIFIER is set, the buyer gates release() on a VERIFIED ok=true and pays the verifier a flat
// fee on-chain (an oracle paid to verify another agent's work). Empty → verification disabled.
const VERIFIER = (process.env.VERIFIER_NAME ?? '').trim()
const VERIFIER_WALLET = (process.env.VERIFIER_WALLET ?? '').trim()
const VERIFY_FEE_SOL = Number(process.env.VERIFY_FEE_SOL ?? '0.0001')
// Stop after this many COMPLETED checks (0 = run forever). The dashboard sets this to 1 when a user
// pastes a token, so "rug-check this token" does exactly one round instead of looping every cycle.
const MAX_ROUNDS = Number(process.env.BUYER_MAX_ROUNDS ?? '0')
const trace = process.env.TRACE === '1'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const expl = (kind: 'tx' | 'address', id: string) => `https://explorer.solana.com/${kind}/${id}?cluster=devnet`

/** Best-value selection via LLM; deterministic cheapest fallback. Returns the winner + its reasoning. */
async function pickWinner(pool: Bid[]): Promise<{ winner: Bid; reason?: string }> {
  if (pool.length === 1) return { winner: pool[0] }
  try {
    const system =
      'You are a buyer choosing the best-value bid for a Solana data service. ' +
      'Reply ONLY with JSON {"by": "<seller name>", "reason": "<short>"}.'
    const user =
      `service=${SERVICE} arg=${ARG} budget=${BUDGET}\nbids:\n` +
      pool.map((b) => `- ${b.by}: ${b.priceSol} SOL${b.note ? ` (${b.note})` : ''}`).join('\n')
    const parsed = parseJsonReply<{ by?: string; reason?: string }>(await complete({ system, user, maxTokens: 100 }))
    const chosen = pool.find((b) => b.by === parsed?.by)
    if (chosen) {
      console.error(`[buyer] picked ${chosen.by} (${chosen.priceSol} SOL): ${parsed?.reason ?? ''}`)
      return { winner: chosen, reason: parsed?.reason }
    }
  } catch {
    /* fall through to deterministic choice */
  }
  return { winner: pickCheapest(pool)!, reason: 'cheapest available' }
}

/** Wait (bounded) for a message matching `round` that `parse` accepts. */
async function waitFor<T>(
  ctx: CoralAgentContext,
  round: number,
  parse: (text: string) => (T & { round: number }) | null,
  maxMs: number,
): Promise<T | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const m = await ctx.waitForMention(Math.max(500, deadline - Date.now()))
    if (!m) continue
    const parsed = parse(m.text)
    if (parsed && parsed.round === round) return parsed
  }
  return null
}

await startCoralAgent({ agentName: process.env.AGENT_NAME ?? 'buyer-agent' }, async (ctx) => {
  const buyer = loadKeypairB58('BUYER_KEYPAIR_B58')
  console.error(`[buyer] market buyer — wallet=${buyer.publicKey.toBase58()} budget=${BUDGET} sellers=[${SELLERS.join(',')}]`)

  // The verifier joins the same thread so the buyer can hand it deliveries to re-check.
  const participants = [...SELLERS, ...(VERIFIER ? [VERIFIER] : [])]
  for (const s of participants) {
    try { await ctx.waitForAgent(s, 8000) } catch { /* may already be present */ }
  }
  if (VERIFIER) console.error(`[buyer] verification ON — ${VERIFIER} re-checks each delivery; fee=${VERIFY_FEE_SOL} SOL`)
  const thread = await ctx.createThread('market', participants)
  const program = await makeProgram(buyer, RPC)

  // Rent bootstrap: a brand-new receive wallet that has never held SOL can't accept a sub-rent
  // payment — the escrow `release` (or the verifier fee) would fail "insufficient funds for rent".
  // On devnet the buyer tops up its counterparties to rent-exemption ONCE so the one-command demo
  // works with only the buyer funded. No-op if already funded or the same wallet as the buyer.
  const ensureRentFunded = async (label: string, addr: string) => {
    if (!addr || addr === buyer.publicKey.toBase58()) return
    try {
      const bal = await program.provider.connection.getBalance(new PublicKey(addr))
      if (bal >= 0.002 * 1e9) return
      const sig = await signTransfer(buyer, addr, 0.01, { maxSol: 0.05 })
      console.error(`[buyer] rent-funded ${label} ${addr} (0.01 SOL) — ${expl('tx', sig)}`)
    } catch (e) {
      console.error(`[buyer] rent-fund ${label} failed (non-fatal): ${(e as Error).message}`)
    }
  }
  await ensureRentFunded('seller', EXPECTED_SELLER_WALLET)
  await ensureRentFunded('verifier', VERIFIER_WALLET)

  let round = 0
  let completed = 0 // rounds that reached a terminal outcome (settled / withheld / no-delivery)

  while (true) {
    if (MAX_ROUNDS && completed >= MAX_ROUNDS) {
      console.error(`[buyer] completed ${completed} check(s) — done (single-shot mode), idling.`)
      break
    }
    try {
      round++
      const arg = ARGS[(round - 1) % ARGS.length] // rotate fixtures so consecutive rounds differ
      if (trace) console.error(`[buyer] round ${round}: WANT ${SERVICE} ${arg} budget=${BUDGET}`)
      await ctx.send(formatWant({ round, service: SERVICE, arg, budgetSol: BUDGET }), thread, SELLERS)

      // ── collect competing bids during the window ──────────────────────────
      const bids: Bid[] = []
      const deadline = Date.now() + BID_WINDOW_MS
      while (Date.now() < deadline) {
        const m = await ctx.waitForMention(Math.max(500, deadline - Date.now()))
        if (!m) continue
        const b = parseBid(m.text)
        if (b && b.round === round) bids.push(b)
      }
      const pool = selectBids(bids, round)
      if (pool.length === 0) { console.error(`[buyer] round ${round}: NO_SELLERS`); await sleep(CYCLE_MS); continue }

      // ── award the best value ──────────────────────────────────────────────
      const { winner, reason } = await pickWinner(pool)
      await ctx.send(formatAward(round, winner.by, reason), thread, [winner.by])

      // ── settle through escrow: deposit → DEPOSITED → wait DELIVERED → release
      const terms = await waitFor<EscrowTerms>(ctx, round, parseEscrowRequired, 15_000)
      if (!terms) { console.error(`[buyer] round ${round}: no escrow terms from ${winner.by}`); await sleep(CYCLE_MS); continue }
      if (!payoutMatches(terms.seller, EXPECTED_SELLER_WALLET)) {
        console.error(`[buyer] round ${round}: escrow payout ${terms.seller} ≠ expected ${EXPECTED_SELLER_WALLET} — skipping`)
        await sleep(CYCLE_MS); continue
      }

      const reference = new PublicKey(terms.reference)
      const seller = new PublicKey(terms.seller)
      const depositSig = await deposit(program, buyer, seller, reference, terms.amountSol, terms.deadlineSecs)
      console.error(`[buyer] round ${round}: DEPOSITED ${terms.amountSol} SOL → ${winner.by}`)
      if (trace) {
        console.error(`[buyer]   escrow PDA: ${expl('address', escrowPda(buyer.publicKey, reference).toBase58())}`)
        console.error(`[buyer]   deposit tx: ${expl('tx', depositSig)}`)
      }
      await ctx.send(
        formatDeposited({ round, reference: terms.reference, buyer: buyer.publicKey.toBase58(), sig: depositSig }),
        thread, [winner.by],
      )

      // Capture the DELIVERED message WITH its report payload (everything after the round tag), so the
      // buyer can hand the report to the verifier.
      const delivered = await waitFor(ctx, round, (t) => {
        const r = messageRound(t)
        if (verb(t) !== 'DELIVERED' || r == null) return null
        const report = t.replace(/^DELIVERED\s+round=\d+\s*/, '').trim()
        return { round: r, report }
      }, 30_000)

      if (!delivered) {
        console.error(`[buyer] round ${round}: no delivery — funds stay in escrow, refundable after the deadline`)
        completed++; await sleep(CYCLE_MS); continue
      }

      // ── verification gate: an independent arbiter re-checks the delivery on-chain ──────────
      let confirmed = true
      if (VERIFIER) {
        await ctx.send(formatVerifyRequest({ round, seller: winner.by, report: delivered.report }), thread, [VERIFIER])
        const verdict = await waitFor<Verdict>(ctx, round, parseVerdict, 30_000)
        if (!verdict) {
          confirmed = false
          console.error(`[buyer] round ${round}: no verdict from ${VERIFIER} — withholding release`)
        } else {
          confirmed = verdict.ok
          console.error(`[buyer] round ${round}: verifier ${verdict.ok ? 'CONFIRMED ✓' : 'REJECTED ✗'} — ${verdict.note ?? ''}`)
        }
      }

      if (!confirmed) {
        // The report failed independent verification. Do NOT release — the deposit refunds after the
        // deadline. This is the dispute/no-show guarantee: the buyer never pays for a bad delivery.
        console.error(`[buyer] round ${round}: NOT RELEASED — verification failed; deposit refundable after the deadline`)
        await ctx.send(`WITHHELD round=${round} reason=verification-failed`, thread, [winner.by])
        completed++; await sleep(CYCLE_MS); continue
      }

      // Verified (or verification disabled) → release the escrow to the seller.
      const releaseSig = await release(program, buyer, seller, reference)
      console.error(`[buyer] round ${round}: RELEASED to ${winner.by} — ${expl('tx', releaseSig)}`)
      await ctx.send(`RELEASED round=${round} sig=${releaseSig}`, thread, [winner.by])
      completed++ // a fully-settled check counts toward the round cap

      // Pay the independent verifier its flat fee on-chain — the second settlement in the graph.
      if (VERIFIER && VERIFIER_WALLET && VERIFY_FEE_SOL > 0) {
        try {
          const feeSig = await signTransfer(buyer, VERIFIER_WALLET, VERIFY_FEE_SOL, { maxSol: BUDGET })
          console.error(`[buyer] round ${round}: paid verifier ${VERIFY_FEE_SOL} SOL — ${expl('tx', feeSig)}`)
          await ctx.send(`VERIFIER_PAID round=${round} sig=${feeSig}`, thread, [VERIFIER])
        } catch (e) {
          console.error(`[buyer] round ${round}: verifier fee failed — ${(e as Error).message}`)
        }
      }
    } catch (e) {
      console.error(`[buyer] round error: ${e}`)
    }
    await sleep(CYCLE_MS)
  }
})
