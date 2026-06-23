'use client'

import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { Zap, TrendingUp, Brain, Cloud, Activity } from 'lucide-react'

interface AgentListing {
  id: string
  role: string
  priceLamports: number
  label: string
  description: string
  category: string
}

const ICONS: Record<string, React.ElementType> = {
  Finance: TrendingUp,
  AI: Brain,
  Data: Cloud,
  Solana: Activity,
}

export function AgentCard({ agent }: { agent: AgentListing }) {
  const { connected } = useWallet()
  const Icon = ICONS[agent.category] ?? Zap
  const priceSOL = (agent.priceLamports / LAMPORTS_PER_SOL).toFixed(4)

  return (
    <div className="card hover:border-brand/40 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Icon size={18} className="text-brand" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{agent.label}</p>
            <span className="badge-gray text-[10px]">{agent.category}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-solana-green font-bold">{priceSOL} SOL</p>
          <p className="text-[10px] text-gray-500">per query</p>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-4 leading-relaxed">{agent.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-solana-green animate-pulse" />
          Live on devnet
        </div>
        {connected ? (
          <Link
            href={`/pay/${agent.id}`}
            className="btn-primary text-sm px-4 py-1.5 inline-block"
          >
            Buy
          </Link>
        ) : (
          <span className="btn-secondary text-sm px-4 py-1.5 cursor-not-allowed opacity-60">
            Connect wallet
          </span>
        )}
      </div>
    </div>
  )
}
