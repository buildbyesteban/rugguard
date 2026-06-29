#!/usr/bin/env node
// Generates devnet wallets, writes .env, and saves the addresses to WALLETS.txt.
// Safe to re-run: existing wallets/keys are preserved; only what's missing is generated.
//
// Usage: node scripts/setup.js              # buyer + seller wallets (the core demo)
//        node scripts/setup.js --rugcheck   # also provision a verifier wallet + rug-check defaults
//        node scripts/setup.js --broker     # also provision a broker wallet (swarm extension, docs/SWARM.md)

import { Keypair } from '@solana/web3.js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import bs58 from 'bs58'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')
const envPath = join(root, '.env')
const examplePath = join(root, '.env.example')
const walletsPath = join(root, 'WALLETS.txt')
const withBroker = process.argv.includes('--broker')
const withRugcheck = process.argv.includes('--rugcheck')

/** Set or append `KEY=value` without disturbing the rest of the file. */
function setKv(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm')
  return re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.replace(/\s*$/, '\n')}${key}=${value}\n`
}
/** Read an existing assignment, or undefined. */
const getKv = (text, key) => text.match(new RegExp(`^${key}=(\\S+)`, 'm'))?.[1]

// Base on an existing .env (preserve user-added keys like ANTHROPIC_API_KEY); else the template.
let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : readFileSync(examplePath, 'utf8')

// Generate only what's missing — re-running never rotates a key you've already funded.
let sellerPubkey = getKv(env, 'WALLET') || Keypair.generate().publicKey.toBase58()
let buyerB58 = getKv(env, 'BUYER_KEYPAIR_B58') || bs58.encode(Keypair.generate().secretKey)
const buyerPubkey = Keypair.fromSecretKey(bs58.decode(buyerB58)).publicKey.toBase58()

env = setKv(env, 'WALLET', sellerPubkey)
env = setKv(env, 'BUYER_KEYPAIR_B58', buyerB58)
env = setKv(env, 'SOLANA_RPC_URL', getKv(env, 'SOLANA_RPC_URL') || 'https://api.devnet.solana.com')

// Optional broker wallet (swarm extension): the broker pays upstream + receives downstream, so it
// needs its own funded keypair distinct from buyer/seller.
let brokerPubkey
if (withBroker) {
  const brokerB58 = getKv(env, 'BROKER_KEYPAIR_B58') || bs58.encode(Keypair.generate().secretKey)
  brokerPubkey = Keypair.fromSecretKey(bs58.decode(brokerB58)).publicKey.toBase58()
  env = setKv(env, 'BROKER_KEYPAIR_B58', brokerB58)
  env = setKv(env, 'BROKER_WALLET', brokerPubkey)
  env = setKv(env, 'ENABLE_BROKER', '1')
}

// Rug-check market: the verifier needs a wallet to RECEIVE its fee (a SOL transfer creates the
// account, so it needs no pre-funding). We store its keypair for completeness but the buyer only
// uses the pubkey. Also flip the buyer to the rug-check service + a default mint to screen.
let verifierPubkey
if (withRugcheck) {
  const verifierB58 = getKv(env, 'VERIFIER_KEYPAIR_B58') || bs58.encode(Keypair.generate().secretKey)
  verifierPubkey = Keypair.fromSecretKey(bs58.decode(verifierB58)).publicKey.toBase58()
  env = setKv(env, 'VERIFIER_KEYPAIR_B58', verifierB58)
  env = setKv(env, 'VERIFIER_WALLET', verifierPubkey)
  env = setKv(env, 'BUYER_SERVICE', 'rugcheck')
  // Default rug-check targets: BONK (authorities renounced → LOW) + USDC (Circle keeps mint/freeze → flagged).
  env = setKv(env, 'BUYER_ARG', getKv(env, 'BUYER_ARG') || 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')
  env = setKv(env, 'VERIFY_FEE_SOL', getKv(env, 'VERIFY_FEE_SOL') || '0.0001')
}

writeFileSync(envPath, env)

// ── report ──
const block = [
  'sol_coralOS — devnet wallets',
  `Generated: ${new Date().toISOString()}`,
  '',
  `  Seller wallet  ${sellerPubkey}`,
  `  Buyer  wallet  ${buyerPubkey}`,
  ...(verifierPubkey ? [`  Verifier wallet ${verifierPubkey}   (receives its fee — no funding needed)`] : []),
  ...(brokerPubkey ? [`  Broker wallet  ${brokerPubkey}   (swarm extension)`] : []),
  '',
  `FUND ${brokerPubkey ? 'ALL THREE' : 'the BUYER (and seller)'} with devnet SOL — the only way is the web faucet`,
  '(sign in with GitHub; CLI/RPC airdrops are gated):',
  '',
  '  https://faucet.solana.com',
  '',
].join('\n')
writeFileSync(walletsPath, block)
console.log('\n' + block)
console.log('(saved to WALLETS.txt · keys written to .env)')
console.log(`
Next: add your LLM key to .env (ANTHROPIC_API_KEY=…, or LLM_PROVIDER=openai + OPENAI_API_KEY),
fund the wallet(s) above, then run the demo:

  npm run dev          # builds the images, starts coral, opens the dashboard
                       # (or: just dev — or the README "by hand" path)
${withBroker ? '\nBroker mode enabled (ENABLE_BROKER=1) — build its image too:\n  docker build -f coral-agents/broker/Dockerfile -t broker:0.1.0 .\n' : ''}
Then click "Start a market" in the dashboard.
`)
