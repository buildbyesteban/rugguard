'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { AgentCard } from '@/components/AgentCard'
import { Header } from '@/components/Header'
import { getClient } from '@/lib/coral'

interface AgentListing {
  id: string
  role: string
  priceLamports: number
  label: string
  description: string
  category: string
}

// Live agents — payment goes on-chain to each agent's devnet wallet.
// Agent delivers real data after Helius detects the transfer.
const DEMO_LISTINGS: AgentListing[] = [
  {
    id: 'weather-agent',
    role: 'worker',
    priceLamports: 500_000, // 0.0005 SOL (~$0.07)
    label: 'Live Weather',
    description: 'Real-time conditions for any city — temperature, humidity, wind, forecast. Powered by open-meteo.com. No API key required.',
    category: 'Data',
  },
]

export default function MarketplacePage() {
  const { connected } = useWallet()
  const [listings] = useState<AgentListing[]>(DEMO_LISTINGS)
  const [, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')

  useEffect(() => {
    // Try to load live agents from coral-server; fall back to static if not running
    const load = async () => {
      try {
        setLoading(true)
        const client = getClient()
        const agentsRaw = await client.listAgents()
        // Only show agents that have a price in SharedState
        if (agentsRaw && agentsRaw.length > 0) {
          // For now keep demo listings, future: merge with live agents
        }
      } catch {
        // coral-server not running — show demo listings
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = activeCategory === 'All'
    ? listings
    : listings.filter(a => a.category === activeCategory)

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 badge-green mb-4 px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-solana-green animate-pulse" />
            <span>Solana Devnet</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">
            Agent Marketplace
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Autonomous agents sell data, AI inference, and on-chain services.
            Pay with SOL. No subscriptions. No API keys.
          </p>
          {!connected && (
            <p className="text-brand mt-4 text-sm font-medium">
              Connect your Phantom wallet to buy →
            </p>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {['All', 'Data'].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-brand text-white'
                  : 'bg-[#1e1e2e] hover:bg-[#2a2a3e] text-gray-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Agent grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(agent => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>

        {/* Architecture note */}
        <div className="mt-16 card border-brand/20">
          <h2 className="font-semibold text-brand mb-3">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400">
            <div>
              <p className="text-white font-medium mb-1">1. Connect Wallet</p>
              <p>Your Phantom wallet holds the SOL. No account, no signup.</p>
            </div>
            <div>
              <p className="text-white font-medium mb-1">2. Pay on Devnet</p>
              <p>Phantom signs a direct SOL transfer on Solana devnet. No subscription, no API key.</p>
            </div>
            <div>
              <p className="text-white font-medium mb-1">3. Agent Delivers</p>
              <p>Rust agents detect your payment via Helius and respond in under 2 seconds.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
