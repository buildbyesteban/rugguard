#!/usr/bin/env node
// Generates devnet wallets and writes .env — run once after git clone
//
// Usage: node scripts/setup.js

import { Keypair } from '@solana/web3.js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import bs58 from 'bs58'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')
const envPath = join(root, '.env')
const examplePath = join(root, '.env.example')

if (existsSync(envPath)) {
  const existing = readFileSync(envPath, 'utf8')
  if (existing.match(/^WALLET=\S+/m) && existing.match(/^BUYER_KEYPAIR_B58=\S+/m)) {
    console.log('.env already has wallets — delete it and re-run if you want fresh keys.')
    process.exit(0)
  }
}

const seller = Keypair.generate()
const buyer  = Keypair.generate()

const sellerPubkey = seller.publicKey.toBase58()
const buyerPubkey  = buyer.publicKey.toBase58()
const buyerB58     = bs58.encode(buyer.secretKey)

// Read .env.example and fill in the generated values
let env = readFileSync(examplePath, 'utf8')
env = env
  .replace(/^WALLET=.*$/m,            `WALLET=${sellerPubkey}`)
  .replace(/^BUYER_KEYPAIR_B58=.*$/m, `BUYER_KEYPAIR_B58=${buyerB58}`)
  .replace(/^SOLANA_RPC_URL=.*$/m,    'SOLANA_RPC_URL=https://api.devnet.solana.com')

writeFileSync(envPath, env)

console.log(`
Setup complete — wallets generated and saved to .env

  Seller wallet  ${sellerPubkey}
  Buyer  wallet  ${buyerPubkey}

Fund both wallets with devnet SOL before running — the only way is the web
faucet (CLI/RPC airdrops are gated):

  https://faucet.solana.com   (sign in with GitHub, paste each address above)

  The Checkout door also uses your Phantom wallet — fund that separately.

Then add ANTHROPIC_API_KEY=sk-ant-... to .env (for the LLM buyer), build the
agent images, and start the economy:

  bash build-agents.sh seller && bash build-agents.sh buyer
  docker build -t user-proxy:0.1.0 coral-agents/user_proxy
  docker compose up -d coral

  # Autonomous (agent → agent):
  cd examples/agent-economy/autonomous && npm install && npm start

  # Checkout (human → agent):
  docker compose up -d bridge        # then open http://localhost:3010 with Phantom

  # No Docker? — examples/agent-economy/quickstart  (bare-metal 402)
`)
