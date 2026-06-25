#!/usr/bin/env node
// Airdrop devnet SOL to the .env wallets (seller `WALLET` + the buyer keypair).
// Best-effort: devnet's faucet is rate-limited, so failures are non-fatal — fall back to
// https://faucet.solana.com. Run after scripts/setup.js (or via `just setup`).

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { readFileSync } from 'fs'

// ── read the repo-root .env (KEY=VALUE) ──
const env = {}
try {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  console.error('No .env — run `node scripts/setup.js` first.')
  process.exit(0)
}

// ── decode a base58 64-byte keypair without a bs58 dependency ──
function decodeB58(b58) {
  const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let n = 0n
  for (const c of b58) {
    const i = A.indexOf(c)
    if (i < 0) throw new Error('invalid base58')
    n = n * 58n + BigInt(i)
  }
  const hex = n.toString(16).padStart(128, '0')
  const bytes = new Uint8Array(64)
  for (let i = 0; i < 64; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

const conn = new Connection(env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed')

const targets = []
if (env.WALLET) targets.push(['seller', new PublicKey(env.WALLET)])
if (env.BUYER_KEYPAIR_B58) {
  try { targets.push(['buyer', Keypair.fromSecretKey(decodeB58(env.BUYER_KEYPAIR_B58)).publicKey]) }
  catch { /* skip malformed keypair */ }
}
if (targets.length === 0) {
  console.error('No WALLET / BUYER_KEYPAIR_B58 in .env — run `node scripts/setup.js` first.')
  process.exit(0)
}

console.log('Airdropping devnet SOL (best-effort)…')
for (const [name, pk] of targets) {
  try {
    const have = (await conn.getBalance(pk)) / LAMPORTS_PER_SOL
    if (have >= 0.5) {
      console.log(`  ✓ ${name}  ${pk.toBase58()}  already funded (${have} SOL)`)
      continue
    }
    const sig = await conn.requestAirdrop(pk, 1 * LAMPORTS_PER_SOL)
    await conn.confirmTransaction(sig, 'confirmed')
    console.log(`  ✓ ${name}  ${pk.toBase58()}  +1 SOL`)
  } catch (e) {
    console.log(`  ✗ ${name}  ${pk.toBase58()}  airdrop failed (${(e.message || e).slice(0, 60)})`)
    console.log(`       → fund manually at https://faucet.solana.com`)
  }
}
