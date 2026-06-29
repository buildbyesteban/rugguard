/**
 * Market protocol — the wire format for the open marketplace, as pure (network-free) functions so it
 * can be fully unit-tested. Agents format/parse these strings and route them over CoralOS threads;
 * settlement happens through the escrow contract. Every message carries a `round` to correlate the
 * many messages flowing through one shared thread.
 *
 *   WANT   round=<n> service=<name> arg=<token> budget=<sol>     buyer  → market, @sellers
 *   BID    round=<n> price=<sol> by=<seller> [note=<free text>]  seller → market (self-selects)
 *   AWARD  round=<n> to=<seller>                                 buyer  → market, @winner
 *   ESCROW_REQUIRED round=<n> reference=<R> seller=<addr> amount=<sol> deadline=<secs>  seller → buyer
 *   DEPOSITED round=<n> reference=<R> buyer=<addr> sig=<sig>     buyer  → seller
 *   (then DELIVERED / RELEASED / REFUNDED reuse the round tag)
 */

export interface Want {
  round: number
  service: string
  arg: string
  budgetSol: number
}

export interface Bid {
  round: number
  priceSol: number
  by: string
  note?: string
}

export interface EscrowTerms {
  round: number
  reference: string
  /** The seller's receive wallet (base58) — the buyer deposits to escrow naming this seller. */
  seller: string
  amountSol: number
  deadlineSecs: number
}

export interface Deposited {
  round: number
  reference: string
  /** The buyer's wallet (base58) — the seller derives the escrow PDA from (buyer, reference). */
  buyer: string
  sig: string
}

export interface Verdict {
  round: number
  /** true → the verifier independently confirmed the delivery; the buyer may release escrow. */
  ok: boolean
  /** Who delivered the work being judged (the seller). */
  seller: string
  /** Free-text reason, surfaced into the transcript/UI. */
  note?: string
}

export interface VerifyRequest {
  round: number
  /** The seller whose delivery is being checked. */
  seller: string
  /** The seller's delivered report (the JSON string deliverService returned). */
  report: string
}

const num = (text: string, key: string): number | undefined => {
  const m = text.match(new RegExp(`${key}=([\\d.]+)`))
  return m ? Number(m[1]) : undefined
}
const tok = (text: string, key: string): string | undefined =>
  text.match(new RegExp(`${key}=(\\S+)`))?.[1]

/** The leading verb of a market message (`WANT`, `BID`, …), or '' if none. */
export function verb(text: string): string {
  return text.trim().split(/\s+/)[0]?.toUpperCase() ?? ''
}

/** Extract the `round` tag for correlation, or undefined. */
export function messageRound(text: string): number | undefined {
  return num(text, 'round')
}

// ── WANT ──────────────────────────────────────────────────────────────────────
export function formatWant(w: Want): string {
  return `WANT round=${w.round} service=${w.service} arg=${w.arg} budget=${w.budgetSol}`
}
export function parseWant(text: string): Want | null {
  if (verb(text) !== 'WANT') return null
  const round = num(text, 'round')
  const service = tok(text, 'service')
  const arg = tok(text, 'arg')
  const budgetSol = num(text, 'budget')
  if (round == null || !service || arg == null || budgetSol == null) return null
  return { round, service, arg, budgetSol }
}

// ── BID ───────────────────────────────────────────────────────────────────────
export function formatBid(b: Bid): string {
  const base = `BID round=${b.round} price=${b.priceSol} by=${b.by}`
  return b.note ? `${base} note=${b.note}` : base
}
export function parseBid(text: string): Bid | null {
  if (verb(text) !== 'BID') return null
  const round = num(text, 'round')
  const priceSol = num(text, 'price')
  const by = tok(text, 'by')
  if (round == null || priceSol == null || !by) return null
  const note = text.match(/note=(.+)$/)?.[1]?.trim()
  return { round, priceSol, by, ...(note ? { note } : {}) }
}

// ── AWARD ─────────────────────────────────────────────────────────────────────
export function formatAward(round: number, to: string, reason?: string): string {
  const base = `AWARD round=${round} to=${to}`
  // The buyer's best-value justification, surfaced into the transcript (quotes neutralized so it
  // doesn't break parsing). The visualizer reads it via reason="…".
  return reason ? `${base} reason="${reason.replace(/"/g, "'")}"` : base
}
export function parseAward(text: string): { round: number; to: string } | null {
  if (verb(text) !== 'AWARD') return null
  const round = num(text, 'round')
  const to = tok(text, 'to')
  if (round == null || !to) return null
  return { round, to }
}

// ── ESCROW_REQUIRED ─────────────────────────────────────────────────────────────
export function formatEscrowRequired(t: EscrowTerms): string {
  return `ESCROW_REQUIRED round=${t.round} reference=${t.reference} seller=${t.seller} amount=${t.amountSol} deadline=${t.deadlineSecs}`
}
export function parseEscrowRequired(text: string): EscrowTerms | null {
  if (verb(text) !== 'ESCROW_REQUIRED') return null
  const round = num(text, 'round')
  const reference = tok(text, 'reference')
  const seller = tok(text, 'seller')
  const amountSol = num(text, 'amount')
  const deadlineSecs = num(text, 'deadline')
  if (round == null || !reference || !seller || amountSol == null || deadlineSecs == null) return null
  return { round, reference, seller, amountSol, deadlineSecs }
}

// ── DEPOSITED ───────────────────────────────────────────────────────────────────
export function formatDeposited(d: Deposited): string {
  return `DEPOSITED round=${d.round} reference=${d.reference} buyer=${d.buyer} sig=${d.sig}`
}
export function parseDeposited(text: string): Deposited | null {
  if (verb(text) !== 'DEPOSITED') return null
  const round = num(text, 'round')
  const reference = tok(text, 'reference')
  const buyer = tok(text, 'buyer')
  const sig = tok(text, 'sig')
  if (round == null || !reference || !buyer || !sig) return null
  return { round, reference, buyer, sig }
}

// ── VERIFY (request) ──────────────────────────────────────────────────────────────
// Buyer → verifier: "independently check this delivery". The report is base64'd so the whole message
// stays single-token-parseable (the report JSON is full of spaces and `=`/`"` that would break tok()).
export function formatVerifyRequest(v: VerifyRequest): string {
  const b64 = Buffer.from(v.report, 'utf8').toString('base64')
  return `VERIFY round=${v.round} seller=${v.seller} report=${b64}`
}
export function parseVerifyRequest(text: string): VerifyRequest | null {
  if (verb(text) !== 'VERIFY') return null
  const round = num(text, 'round')
  const seller = tok(text, 'seller')
  const b64 = tok(text, 'report')
  if (round == null || !seller || !b64) return null
  let report: string
  try { report = Buffer.from(b64, 'base64').toString('utf8') } catch { return null }
  return { round, seller, report }
}

// ── VERIFIED ────────────────────────────────────────────────────────────────────
// Posted by the verifier/arbiter agent after it INDEPENDENTLY re-checks the seller's delivery against
// the chain. The buyer gates `release()` on `ok=true`; on `ok=false` it withholds release and the
// deposit refunds after the deadline. This is the "oracle paid to verify another's work" leg.
export function formatVerdict(v: Verdict): string {
  const base = `VERIFIED round=${v.round} ok=${v.ok} seller=${v.seller}`
  return v.note ? `${base} note=${v.note.replace(/\s+/g, ' ').trim()}` : base
}
export function parseVerdict(text: string): Verdict | null {
  if (verb(text) !== 'VERIFIED') return null
  const round = num(text, 'round')
  const okTok = tok(text, 'ok')
  const seller = tok(text, 'seller')
  if (round == null || okTok == null || !seller) return null
  const note = text.match(/note=(.+)$/)?.[1]?.trim()
  return { round, ok: okTok === 'true', seller, ...(note ? { note } : {}) }
}

// ── selection ───────────────────────────────────────────────────────────────────
/** Keep only bids for `round`, deduped by seller (last bid wins). */
export function selectBids(bids: Bid[], round: number): Bid[] {
  const bySeller = new Map<string, Bid>()
  for (const b of bids) if (b.round === round) bySeller.set(b.by, b)
  return [...bySeller.values()]
}

/** The cheapest bid (does not mutate input); undefined if none. Ties → first seen. */
export function pickCheapest(bids: Bid[]): Bid | undefined {
  return [...bids].sort((a, b) => a.priceSol - b.priceSol)[0]
}
