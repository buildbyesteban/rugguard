/**
 * Marketplace starter — the headline example.
 *
 * Launches one session graph: a market buyer + three LLM seller personas. coral-server spawns each
 * as a container; the buyer broadcasts a WANT, the sellers compete with LLM bids, and the winner is
 * settled through the escrow contract. All sellers reuse the seller-agent image and share the receive
 * wallet — differentiation is persona/floor/inventory (set in each coral-agent.toml), not code.
 *
 *   CORAL_SERVER_URL  default http://localhost:5555
 *   CORAL_TOKEN       default dev   (must be in coral.toml [auth] keys)
 *
 * Run from the host after `docker compose up coral`:  npm install && npm start
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = process.env.CORAL_SERVER_URL ?? 'http://localhost:5555'
const TOKEN = process.env.CORAL_TOKEN ?? 'dev'
const NS = 'default'
const AUTH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

// ── Load repo-root .env (2 levels up: marketplace → examples → root) ──
function loadEnv(): Record<string, string> {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const env: Record<string, string> = { ...(process.env as Record<string, string>) }
  try {
    for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env — rely on process.env */ }
  return env
}

// ── Typed coral option values ──
const str = (value: string) => ({ type: 'string', value })
const f64 = (value: number) => ({ type: 'f64', value })

const agent = (name: string, options: Record<string, unknown>) => ({
  id: { name, version: '0.1.0', registrySourceId: { type: 'local' } },
  name,
  provider: { type: 'local', runtime: 'docker' },
  options,
})

async function main() {
  const env = loadEnv()
  const wallet = env.WALLET
  const keypair = env.BUYER_KEYPAIR_B58
  if (!wallet || !keypair) {
    throw new Error('WALLET and BUYER_KEYPAIR_B58 must be set in .env — run `node scripts/setup.js`')
  }
  const rpc = env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
  const trace = env.TRACE ?? ''

  // LLM provider — Anthropic by default; flip the whole market with LLM_PROVIDER=openai in .env.
  const llmOpts: Record<string, unknown> = {}
  if (env.ANTHROPIC_API_KEY) llmOpts.ANTHROPIC_API_KEY = str(env.ANTHROPIC_API_KEY)
  if (env.OPENAI_API_KEY) llmOpts.OPENAI_API_KEY = str(env.OPENAI_API_KEY)
  if (env.LLM_PROVIDER) llmOpts.LLM_PROVIDER = str(env.LLM_PROVIDER)
  if (env.LLM_MODEL) llmOpts.LLM_MODEL = str(env.LLM_MODEL)
  if (trace) llmOpts.TRACE = str(trace)

  // ── Rug-check market (BUYER_SERVICE=rugcheck) — the headline fork ────────────────────────────────
  // A Solana token rug-check oracle: two seller personas compete to screen a mint (fast scanner vs
  // premium auditor); an INDEPENDENT verifier re-reads the chain and gates the escrow release; the
  // buyer pays the winning seller (escrow) AND the verifier (flat fee) on-chain. A graph, not a pair.
  if ((env.BUYER_SERVICE ?? '') === 'rugcheck') {
    const rugRpc = env.RUGCHECK_RPC_URL ?? ''           // mainnet read RPC (Helius etc.); '' → public default
    const verifierWallet = env.VERIFIER_WALLET ?? ''    // where the verifier's fee lands (node scripts/setup.js)
    const rugSellers = ['seller-scanner', 'seller-auditor']
    // Real mainnet mints to rotate through. Default: BONK (authorities renounced — should read LOW risk).
    const mints = (env.BUYER_ARGS || env.BUYER_ARG || 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')
      .split(',').map((s) => s.trim()).filter(Boolean)

    const rugSeller = (name: string) =>
      agent(name, {
        SELLER_WALLET: str(wallet), SOLANA_RPC_URL: str(rpc), AGENT_NAME: str(name),
        SERVICES: str('rugcheck'), SERVICE: str('rugcheck'),
        ...(rugRpc ? { RUGCHECK_RPC_URL: str(rugRpc) } : {}),
        ...llmOpts,
      })
    const verifierAgent = agent('verifier-agent', {
      AGENT_NAME: str('verifier-agent'),
      ...(rugRpc ? { RUGCHECK_RPC_URL: str(rugRpc) } : {}),
      ...llmOpts,
    })
    const rugBuyerOpts: Record<string, unknown> = {
      BUYER_KEYPAIR_B58: str(keypair), AGENT_NAME: str('buyer-agent'), SOLANA_RPC_URL: str(rpc),
      SELLER_WALLET: str(wallet),
      BUYER_MAX_SOL: f64(Number(env.BUYER_MAX_SOL ?? '0.001')),
      BUYER_SERVICE: str('rugcheck'),
      BUYER_ARG: str(mints[0]),
      ...(mints.length > 1 ? { BUYER_ARGS: str(mints.join(',')) } : {}),
      MARKET_SELLERS: str(rugSellers.join(',')),
      VERIFIER_NAME: str('verifier-agent'),
      ...(verifierWallet ? { VERIFIER_WALLET: str(verifierWallet) } : {}),
      ...(env.VERIFY_FEE_SOL ? { VERIFY_FEE_SOL: f64(Number(env.VERIFY_FEE_SOL)) } : {}),
      ...llmOpts,
    }

    const rres = await fetch(`${BASE}/api/v1/local/session`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({
        agentGraphRequest: {
          agents: [agent('buyer-agent', rugBuyerOpts), rugSeller('seller-scanner'), rugSeller('seller-auditor'), verifierAgent],
        },
        namespaceProvider: { type: 'create_if_not_exists', namespaceRequest: { name: NS } },
        execution: { mode: 'immediate' },
      }),
    })
    if (!rres.ok) throw new Error(`session create failed: ${rres.status} ${await rres.text()}`)
    const { sessionId } = await rres.json() as { sessionId: string }

    console.log(`\n✅ Market session ${sessionId} — rug-check: buyer + seller-scanner, seller-auditor + verifier-agent.`)
    console.log(`   screening mint(s): ${mints.join(', ')}`)
    console.log(`   receive wallet: ${wallet}${verifierWallet ? `   verifier wallet: ${verifierWallet}` : ''}`)
    console.log('   Buyer WANTs a rug-check; sellers bid; the verifier re-reads the chain; release only on a pass.\n')
    console.log('   Watch the market:')
    console.log('     docker logs -f buyer-agent       # WANT → AWARD → DEPOSITED → (verify) → RELEASED + verifier paid')
    console.log('     docker logs -f verifier-agent    # VERIFIED ok=true|false (independent on-chain re-check)')
    console.log('   Set TRACE=1 in .env to see the coral_* calls + Explorer links.\n')
    return
  }

  // Every seller shares the receive wallet + RPC; persona/floor/inventory come from each toml default.
  const seller = (name: string) =>
    agent(name, { SELLER_WALLET: str(wallet), SOLANA_RPC_URL: str(rpc), AGENT_NAME: str(name), ...llmOpts })

  // World Cup specialist — only joins when a TxLINE token is present (see examples/txodds/DEMO.md).
  // It carries SERVICES=txline + the token; the generalist personas decline txline WANTs automatically.
  const txlineKey = env.TXLINE_API_KEY
  const worldcup = txlineKey
    ? [agent('seller-worldcup', {
        SELLER_WALLET: str(wallet), SOLANA_RPC_URL: str(rpc), AGENT_NAME: str('seller-worldcup'),
        SERVICES: str('txline'), FLOOR_SOL: f64(Number(env.WORLDCUP_FLOOR_SOL ?? '0.0005')),
        TXLINE_API_KEY: str(txlineKey),
        ...(env.TXLINE_BASE_URL ? { TXLINE_BASE_URL: str(env.TXLINE_BASE_URL) } : {}),
        ...llmOpts,
      })]
    : []

  const sellers = ['seller-cheap', 'seller-premium', 'seller-lazy', ...(txlineKey ? ['seller-worldcup'] : [])]

  // Optional broker swarm (ENABLE_BROKER=1, see docs/SWARM.md): the buyer buys from a broker, which
  // resells from the real sellers. Needs a funded broker wallet — `node scripts/setup.js --broker`.
  const brokerWanted = env.ENABLE_BROKER === '1'
  const brokerReady = brokerWanted && !!env.BROKER_KEYPAIR_B58 && !!env.BROKER_WALLET
  if (brokerWanted && !brokerReady) {
    console.warn('[marketplace] ENABLE_BROKER=1 but BROKER_KEYPAIR_B58/BROKER_WALLET missing — run `node scripts/setup.js --broker`. Skipping broker.')
  }
  const brokerAgents = brokerReady
    ? [agent('broker', {
        BROKER_KEYPAIR_B58: str(env.BROKER_KEYPAIR_B58), BROKER_WALLET: str(env.BROKER_WALLET),
        AGENT_NAME: str('broker'), SOLANA_RPC_URL: str(rpc), UPSTREAM_SELLERS: str(sellers.join(',')),
        ...(env.BROKER_MARGIN_SOL ? { BROKER_MARGIN_SOL: f64(Number(env.BROKER_MARGIN_SOL)) } : {}),
        ...llmOpts,
      })]
    : []
  // Who the buyer shops + the payout wallet it binds the escrow to (F3): the broker if enabled, else the sellers.
  const buyerSellers = brokerReady ? ['broker'] : sellers
  const buyerExpectedWallet = brokerReady ? env.BROKER_WALLET : wallet

  // F8: a txline market needs both the World Cup token AND the worldcup seller. If .env still says
  // BUYER_SERVICE=txline but no token is present (e.g. a stale .env after a failed mint), fall back to
  // the generic market rather than broadcasting txline WANTs nothing can fill.
  const wantsTxline = (env.BUYER_SERVICE ?? 'coingecko') === 'txline'
  const fellBack = wantsTxline && !txlineKey
  if (fellBack) console.warn('[marketplace] BUYER_SERVICE=txline but no TXLINE_API_KEY — falling back to coingecko.')
  const buyerService = fellBack ? 'coingecko' : (env.BUYER_SERVICE ?? 'coingecko')
  const buyerArg = fellBack ? 'SOL-USDC' : (env.BUYER_ARG ?? 'SOL-USDC')
  const buyerArgs = fellBack ? '' : (env.BUYER_ARGS ?? '')

  const buyerOpts: Record<string, unknown> = {
    BUYER_KEYPAIR_B58: str(keypair),
    AGENT_NAME: str('buyer-agent'),
    SOLANA_RPC_URL: str(rpc),
    // F3: the expected seller payout wallet — the buyer binds the escrow seller= to it (broker if enabled).
    SELLER_WALLET: str(buyerExpectedWallet),
    BUYER_MAX_SOL: f64(Number(env.BUYER_MAX_SOL ?? '0.001')),
    BUYER_SERVICE: str(buyerService),
    BUYER_ARG: str(buyerArg),
    ...(buyerArgs ? { BUYER_ARGS: str(buyerArgs) } : {}),
    MARKET_SELLERS: str(buyerSellers.join(',')),
    ...llmOpts,
  }

  const sres = await fetch(`${BASE}/api/v1/local/session`, {
    method: 'POST', headers: AUTH,
    body: JSON.stringify({
      agentGraphRequest: {
        agents: [
          agent('buyer-agent', buyerOpts),
          seller('seller-cheap'),
          seller('seller-premium'),
          seller('seller-lazy'),
          ...worldcup,
          ...brokerAgents,
        ],
      },
      namespaceProvider: { type: 'create_if_not_exists', namespaceRequest: { name: NS } },
      execution: { mode: 'immediate' },
    }),
  })
  if (!sres.ok) throw new Error(`session create failed: ${sres.status} ${await sres.text()}`)
  const { sessionId } = await sres.json() as { sessionId: string }

  const lineup = brokerReady ? `broker (reselling ${sellers.join(', ')})` : sellers.join(', ')
  console.log(`\n✅ Market session ${sessionId} — buyer + ${lineup}.`)
  console.log(`   receive wallet: ${wallet}`)
  console.log('   The buyer broadcasts a WANT; sellers bid; the winner settles via escrow.\n')
  console.log('   Watch the market:')
  console.log('     docker logs -f buyer-agent      # WANT → AWARD (with a reason) → DEPOSITED → RELEASED')
  console.log('     docker logs -f seller-cheap     # BID → ESCROW_REQUIRED → DELIVERED')
  console.log('   Set TRACE=1 in .env to see the coral_* calls + Explorer links for deposit/release.\n')
}

main().catch((e) => { console.error(`[marketplace] ${e}`); process.exitCode = 1 })
