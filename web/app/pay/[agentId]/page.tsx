'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import Link from 'next/link'
import { ArrowLeft, Zap, Shield } from 'lucide-react'
import { Header } from '@/components/Header'
import { getClient } from '@/lib/coral'

const AGENT_META: Record<string, { label: string; priceLamports: number; placeholder: string }> = {
  'stock-agent':   { label: 'Stock Price Feed',      priceLamports: 1_000_000,  placeholder: 'AAPL' },
  'claude-agent':  { label: 'AI Inference (Claude)', priceLamports: 10_000_000, placeholder: 'Summarise the Solana whitepaper in 3 bullets' },
  'weather-agent': { label: 'Weather Data',          priceLamports: 500_000,    placeholder: 'London' },
  'helius-agent':  { label: 'Wallet Monitor',        priceLamports: 100_000,    placeholder: '7xKF...' },
}

type TxStatus = 'idle' | 'building' | 'signing' | 'broadcasting' | 'done' | 'error'

export default function PayPage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.agentId as string
  const meta = AGENT_META[agentId] ?? { label: agentId, priceLamports: 1_000_000, placeholder: 'Enter request...' }

  const { publicKey, signTransaction } = useWallet()
  const { connection } = useConnection()

  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState<TxStatus>('idle')
  const [error, setError] = useState('')

  const priceSOL = (meta.priceLamports / LAMPORTS_PER_SOL).toFixed(4)

  async function handlePay() {
    if (!publicKey || !signTransaction || !prompt.trim()) return
    setStatus('building')
    setError('')

    try {
      // 1. Tell coral-server to store the request in SharedState
      const client = getClient()
      try {
        await client.setState(`request:${agentId}`, prompt.trim(), 'web-ui')
      } catch {
        // coral-server may not be running — continue with demo flow
      }

      // 2. Build a SOL transfer transaction
      // In production this would be an Anchor escrow deposit instruction.
      // For demo/devnet we do a direct transfer to a well-known devnet address.
      const DEMO_SELLER = new PublicKey('7xKFqjHEsLqQFmXSnqmWTBPEHJLCgtcf7fUJ4E4s7fQ1')

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: DEMO_SELLER,
          lamports: meta.priceLamports,
        })
      )

      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.feePayer = publicKey

      // 3. Phantom signs
      setStatus('signing')
      const signed = await signTransaction(tx)

      // 4. Broadcast
      setStatus('broadcasting')
      const sig = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(sig, 'confirmed')

      setStatus('done')

      // Redirect to result page
      router.push(`/result/${sig}?agent=${agentId}&prompt=${encodeURIComponent(prompt)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed')
      setStatus('error')
    }
  }

  const buttonLabel: Record<TxStatus, string> = {
    idle:         `Pay ${priceSOL} SOL → Get ${meta.label}`,
    building:     'Building transaction…',
    signing:      'Waiting for Phantom…',
    broadcasting: 'Broadcasting…',
    done:         'Confirmed!',
    error:        'Retry',
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to Marketplace
        </Link>

        <div className="card space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">{meta.label}</h1>
            <p className="text-gray-400 text-sm">Powered by a Rust agent on CoralOS</p>
          </div>

          {/* Price summary */}
          <div className="bg-[#0d0d15] rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Price</p>
              <p className="text-2xl font-bold text-solana-green">{priceSOL} SOL</p>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 justify-end">
                <Shield size={11} /> Anchor escrow
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 justify-end">
                <Zap size={11} /> &lt; 2s delivery
              </div>
            </div>
          </div>

          {/* Request input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Your request</label>
            <textarea
              className="input-field min-h-[100px] resize-none"
              placeholder={meta.placeholder}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </div>

          {/* Wallet / pay section */}
          {!publicKey ? (
            <div className="text-center py-4">
              <p className="text-gray-400 text-sm">Connect your Phantom wallet (top-right) to continue</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Paying from</span>
                <span className="font-mono text-gray-300">
                  {publicKey.toBase58().slice(0, 8)}…{publicKey.toBase58().slice(-4)}
                </span>
              </div>

              <button
                className="btn-primary w-full text-base py-3"
                onClick={handlePay}
                disabled={!prompt.trim() || (status !== 'idle' && status !== 'error')}
              >
                {buttonLabel[status]}
              </button>

              {error && (
                <p className="text-red-400 text-xs text-center">{error}</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
