/**
 * Token rug-check — the on-chain facts a Solana SPL token reveals about its own risk, plus a pure
 * scorer over them. This is the shared spine of the rug-check market: the SELLER fetches these facts
 * and sells a report; the VERIFIER fetches them INDEPENDENTLY and refuses to confirm a report whose
 * claims don't match the chain. Neither trusts the other's word — both read the same source of truth.
 *
 * Reads are READ-ONLY and target MAINNET (that's where the tokens worth screening live). No value
 * moves here, so this deliberately builds a plain `Connection` and does NOT go through the devnet
 * guard in `solana/connection.ts` — that guard protects payments/escrow, which always stay on devnet.
 */
import { Connection, PublicKey, type ParsedAccountData } from '@solana/web3.js'

/** Default mainnet RPC for the read-only analysis. Override with RUGCHECK_RPC_URL (e.g. a Helius URL). */
export const DEFAULT_RUGCHECK_RPC = 'https://api.mainnet-beta.solana.com'

/** The raw, independently-verifiable facts an SPL mint exposes on-chain. */
export interface TokenFacts {
  mint: string
  /** false → no account / not an SPL mint at this address. */
  exists: boolean
  decimals: number
  /** Raw integer supply (base units), as a string to avoid precision loss. */
  supply: string
  /** Human-readable supply (supply / 10^decimals). */
  uiSupply: number
  /** true → mint authority is null (supply is fixed; can't be inflated). The safer state. */
  mintAuthorityRenounced: boolean
  /** true → freeze authority is null (holders' tokens can't be frozen). The safer state. */
  freezeAuthorityRenounced: boolean
  /** % of supply held by the single largest token account (0 if unknown). */
  topHolderPct: number
  /** % of supply held by the largest accounts sampled (top ~10). */
  top10Pct: number
  /** How many largest accounts the RPC returned (the sample behind the % above). */
  holderSample: number
}

export type RiskLevel = 'HIGH RISK' | 'CAUTION' | 'LOOKS OK'

export interface RiskAssessment {
  /** 0–100, higher = riskier. */
  score: number
  level: RiskLevel
  /** Human-readable risk flags, worst-first. */
  signals: string[]
}

const pct = (n: number) => Math.round(n * 10) / 10

/**
 * Read the on-chain facts for `mint` from `rpcUrl` (read-only). Throws on an invalid address or a
 * network failure so the caller decides how to surface it; returns `exists:false` for a real address
 * that simply isn't an SPL mint.
 */
export async function fetchTokenFacts(mint: string, rpcUrl = DEFAULT_RUGCHECK_RPC): Promise<TokenFacts> {
  const key = new PublicKey(mint) // throws on a malformed address — a clear, early failure
  const conn = new Connection(rpcUrl, 'confirmed')

  const acct = await conn.getParsedAccountInfo(key)
  const value = acct.value
  const parsed = value && 'parsed' in (value.data as ParsedAccountData)
    ? (value.data as ParsedAccountData).parsed
    : undefined
  if (!parsed || parsed.type !== 'mint') {
    return {
      mint, exists: false, decimals: 0, supply: '0', uiSupply: 0,
      mintAuthorityRenounced: true, freezeAuthorityRenounced: true,
      topHolderPct: 0, top10Pct: 0, holderSample: 0,
    }
  }

  const info = parsed.info as {
    decimals: number; supply: string
    mintAuthority: string | null; freezeAuthority: string | null
  }
  const decimals = info.decimals ?? 0
  const supply = String(info.supply ?? '0')
  const uiSupply = Number(supply) / 10 ** decimals

  // Holder concentration — the largest token accounts (RPC returns up to 20). This is a heuristic:
  // the top accounts can be a locked LP, a CEX hot wallet, or a burn address, so a high number is a
  // flag to investigate, not proof of a rug. The report says so.
  let topHolderPct = 0, top10Pct = 0, holderSample = 0
  try {
    const largest = await conn.getTokenLargestAccounts(key)
    const accts = largest.value ?? []
    holderSample = accts.length
    if (uiSupply > 0 && accts.length > 0) {
      const ui = accts.map((a) => a.uiAmount ?? 0)
      topHolderPct = pct((ui[0] / uiSupply) * 100)
      top10Pct = pct((ui.slice(0, 10).reduce((s, n) => s + n, 0) / uiSupply) * 100)
    }
  } catch {
    /* largest-accounts can be unavailable on some RPCs — leave concentration at 0 (unknown). */
  }

  return {
    mint, exists: true, decimals, supply, uiSupply,
    mintAuthorityRenounced: info.mintAuthority == null,
    freezeAuthorityRenounced: info.freezeAuthority == null,
    topHolderPct, top10Pct, holderSample,
  }
}

/**
 * Pure risk scorer over {@link TokenFacts}. Deterministic so the seller's report and the verifier's
 * recompute agree on identical facts — the LLM only adds a human-readable call ON TOP of this number.
 */
export function scoreFacts(f: TokenFacts): RiskAssessment {
  if (!f.exists) {
    return { score: 100, level: 'HIGH RISK', signals: ['No SPL mint found at this address — do not trade.'] }
  }
  let score = 0
  const signals: string[] = []

  if (!f.mintAuthorityRenounced) {
    score += 35
    signals.push('Mint authority is still active — the supply can be inflated at any time (classic rug vector).')
  }
  if (!f.freezeAuthorityRenounced) {
    score += 25
    signals.push('Freeze authority is active — the team can freeze your tokens so you cannot sell.')
  }
  if (f.topHolderPct >= 50) {
    score += 25
    signals.push(`A single wallet holds ${f.topHolderPct}% of supply — one seller can crash the price.`)
  } else if (f.topHolderPct >= 25) {
    score += 12
    signals.push(`The largest wallet holds ${f.topHolderPct}% of supply — concentrated ownership.`)
  }
  if (f.top10Pct >= 80) {
    score += 15
    signals.push(`The top holders hold ${f.top10Pct}% of supply combined — thin float, easy to move.`)
  }

  if (signals.length === 0) {
    signals.push('Mint & freeze authorities renounced and no extreme holder concentration detected.')
  }
  signals.push('Heuristic only — top holders may be a locked LP, a CEX, or a burn address. Not financial advice.')

  score = Math.min(100, score)
  const level: RiskLevel = score >= 55 ? 'HIGH RISK' : score >= 30 ? 'CAUTION' : 'LOOKS OK'
  return { score, level, signals }
}

/**
 * The verifier's check: do two independently-fetched fact sets agree on the claims that drive the
 * score? Authorities must match exactly; concentration must match within a tolerance (RPCs sample
 * largest-accounts at slightly different moments). Returns the disagreements for the transcript.
 */
export function factsMatch(seller: TokenFacts, chain: TokenFacts, tolerancePct = 5): { ok: boolean; diffs: string[] } {
  const diffs: string[] = []
  if (seller.exists !== chain.exists) diffs.push(`exists: seller=${seller.exists} chain=${chain.exists}`)
  if (seller.mintAuthorityRenounced !== chain.mintAuthorityRenounced)
    diffs.push(`mintAuthorityRenounced: seller=${seller.mintAuthorityRenounced} chain=${chain.mintAuthorityRenounced}`)
  if (seller.freezeAuthorityRenounced !== chain.freezeAuthorityRenounced)
    diffs.push(`freezeAuthorityRenounced: seller=${seller.freezeAuthorityRenounced} chain=${chain.freezeAuthorityRenounced}`)
  // Holder concentration is only comparable when BOTH reads actually returned holder data — a
  // rate-limited RPC reports sample=0 (unknown), which must not look like a disagreement.
  if (seller.holderSample > 0 && chain.holderSample > 0 &&
      Math.abs(seller.topHolderPct - chain.topHolderPct) > tolerancePct)
    diffs.push(`topHolderPct: seller=${seller.topHolderPct} chain=${chain.topHolderPct}`)
  return { ok: diffs.length === 0, diffs }
}
