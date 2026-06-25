/**
 * Seller agent — autonomous CoralOS participant that sells data services for SOL.
 *
 * Command protocol (messages received from buyers via CoralOS):
 * - `request <query>`                  → generate a Solana Pay URL; reply `PAYMENT_REQUIRED ...`
 * - `paid <sig> reference=<reference>` → verify payment on-chain (bound to the reference); reply
 *                                        `DELIVERED <data>` or `ERROR ...`
 *
 * Environment variables required:
 * - `SELLER_WALLET`    — base58 public key to receive payments
 * - `PRICE_SOL`        — price per request in SOL (default `"0.0001"`)
 * - `CORAL_CONNECTION_URL` — CoralOS MCP server URL
 */
import { startCoralAgent } from '@pay/agent-runtime'
import { generatePaymentUrl, verifyPayment } from './payment.js'
import { deliverService } from './service.js'
import { ReplayGuard } from './replay.js'

// Pending payments: reference (base58 pubkey) → { request }
const pending = new Map<string, { request: string }>()

// Consumed payment signatures — rejects reuse of one payment as proof for many requests.
const replay = new ReplayGuard()

await startCoralAgent({ agentName: 'seller-agent' }, async (ctx) => {
  console.error('[seller-agent] ready — waiting for buyers')

  while (true) {
    try {
    const mention = await ctx.waitForMention()
    if (!mention) continue

    const text = mention.text.trim()
    console.error(`[seller-agent] mention: ${text.slice(0, 120)}`)

    // ── Command routing ──────────────────────────────────────────────────────

    // "request <query>" — buyer wants a service, get a payment URL first
    if (text.toLowerCase().startsWith('request')) {
      const query = text.replace(/^request\s*/i, '').trim() || 'default'
      const { url, reference, amountSol } = generatePaymentUrl(query)
      pending.set(reference, { request: query })
      await ctx.reply(
        mention,
        `PAYMENT_REQUIRED reference=${reference} amount=${amountSol} url=${url}`,
      )
      continue
    }

    // "paid <sig> reference=<reference>" — buyer claims to have paid
    if (text.toLowerCase().startsWith('paid')) {
      const sigMatch = text.match(/paid\s+(\S+)/i)
      const refMatch = text.match(/reference=(\S+)/i)
      const sig = sigMatch?.[1]
      const reference = refMatch?.[1]

      if (!sig || !reference) {
        await ctx.reply(mention, 'ERROR: expected format: paid <sig> reference=<reference>')
        continue
      }

      const entry = pending.get(reference)
      if (!entry) {
        await ctx.reply(mention, `ERROR: unknown reference ${reference}`)
        continue
      }

      // Reject a signature already used as proof for another order.
      if (replay.has(sig)) {
        await ctx.reply(mention, `ERROR: payment signature already used`)
        continue
      }

      console.error(`[seller-agent] verifying payment sig=${sig} reference=${reference}`)
      // Bound to the per-request reference: the proof can't be reused or stolen for another order.
      const verified = await verifyPayment(sig, reference)

      if (!verified) {
        await ctx.reply(mention, `ERROR: payment not confirmed for reference=${reference}`)
        continue
      }

      replay.consume(sig)
      pending.delete(reference)
      console.error(`[seller-agent] payment verified — delivering service`)

      try {
        const result = await deliverService(entry.request)
        await ctx.reply(mention, `DELIVERED ${result}`)
      } catch (e) {
        console.error(`[seller-agent] delivery error: ${e}`)
        await ctx.reply(mention, `ERROR: service delivery failed — ${(e as Error).message}`)
      }
      continue
    }

    // Unknown command
    await ctx.reply(
      mention,
      'Commands: "request <query>" to get a payment URL, "paid <sig> reference=<reference>" after paying',
    )
    } catch (e) {
      console.error(`[seller-agent] loop error: ${e}`)
    }
  }
})
