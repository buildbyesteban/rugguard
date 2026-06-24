'use client'

import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { Cloud } from 'lucide-react'

interface AgentListing {
  id: string
  label: string
  priceLamports: number
  description: string
  category: string
}

export function AgentCard({ agent }: { agent: AgentListing }) {
  const { connected } = useWallet()
  const priceSOL = (agent.priceLamports / LAMPORTS_PER_SOL).toFixed(4)

  return (
    <div className="card hover:border-brand/40 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Cloud size={16} className="text-brand" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{agent.label}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-solana-green animate-pulse" />
              <span className="text-[10px] text-gray-500">Live · devnet</span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-solana-green font-bold">{priceSOL} SOL</p>
          <p className="text-[10px] text-gray-500">per query</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4 leading-relaxed">{agent.description}</p>

      {connected ? (
        <Link
          href={`/pay/${agent.id}`}
          className="btn-primary text-sm px-5 py-2 inline-block w-full text-center"
        >
          Buy
        </Link>
      ) : (
        <button disabled className="btn-secondary text-sm px-5 py-2 w-full opacity-50 cursor-not-allowed">
          Connect wallet to buy
        </button>
      )}
    </div>
  )
}
