'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, ExternalLink, ArrowLeft, RefreshCw } from 'lucide-react'
import { Header } from '@/components/Header'
import { AgentLiveLog } from '@/components/AgentLiveLog'
import { getClient } from '@/lib/coral'

export default function ResultPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const txSig = params.txSig as string
  const agentId = searchParams.get('agent') ?? ''
  const prompt = searchParams.get('prompt') ?? ''

  const [result, setResult] = useState<string | null>(null)
  const [polling, setPolling] = useState(true)

  useEffect(() => {
    if (!agentId) return

    let resolved = false

    // Poll SharedState for the agent's response key
    const interval = setInterval(async () => {
      if (resolved) return
      try {
        const client = getClient()
        const allState = await client.getAllState()
        const entry = allState[`result:${agentId}`]
        if (entry) {
          setResult(JSON.stringify(entry.value, null, 2))
          setPolling(false)
          resolved = true
          clearInterval(interval)
        }
      } catch {
        // coral-server not running — demo fallback handles it
      }
    }, 1000)

    // Demo fallback: show mock result after 3 seconds if coral-server not running
    const demo = setTimeout(() => {
      if (!resolved) {
        const mockData =
          agentId === 'stock-agent'
            ? { AAPL: 189.42, MSFT: 412.11, source: 'demo-agent' }
            : agentId === 'weather-agent'
            ? { city: 'London', temp: '18°C', condition: 'Partly cloudy', source: 'demo-agent' }
            : agentId === 'claude-agent'
            ? { response: 'This is a demo Claude response. Deploy coral-server for live inference.', prompt }
            : { response: 'Agent delivered successfully', prompt, source: 'demo-agent' }

        setResult(JSON.stringify({
          ...mockData,
          delivered_at: new Date().toISOString(),
        }, null, 2))
        setPolling(false)
        resolved = true
        clearInterval(interval)
      }
    }, 3000)

    return () => {
      clearInterval(interval)
      clearTimeout(demo)
    }
  }, [agentId, prompt])

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} /> Marketplace
        </Link>

        {/* Transaction confirmed */}
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="text-solana-green shrink-0" size={22} />
            <div>
              <p className="font-semibold text-white">Payment confirmed on Solana</p>
              <a
                href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-brand flex items-center gap-1 mt-0.5 transition-colors"
              >
                {txSig.slice(0, 20)}… <ExternalLink size={10} />
              </a>
            </div>
          </div>
          {prompt && (
            <p className="text-xs text-gray-500 mt-2 font-mono border-t border-[#1e1e2e] pt-2">
              Request: {decodeURIComponent(prompt).slice(0, 120)}
            </p>
          )}
        </div>

        {/* Agent response */}
        <div className="card">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            Agent Response
            {polling && <RefreshCw size={13} className="animate-spin text-brand" />}
          </h2>
          {result ? (
            <pre className="bg-[#0d0d15] rounded-lg p-4 text-sm font-mono text-solana-green overflow-x-auto whitespace-pre-wrap break-words">
              {result}
            </pre>
          ) : (
            <div className="bg-[#0d0d15] rounded-lg p-4 text-sm text-gray-500 animate-pulse">
              Waiting for agent to deliver…
            </div>
          )}
        </div>

        {/* Live agent log */}
        {agentId && (
          <div className="card">
            <h2 className="font-semibold mb-3 text-sm text-gray-400">Agent activity</h2>
            <AgentLiveLog agentId={agentId} />
          </div>
        )}

        <div className="flex gap-3">
          <Link href={`/pay/${agentId}`} className="btn-secondary flex-1 text-center text-sm py-2.5">
            Buy again
          </Link>
          <Link href="/" className="btn-secondary flex-1 text-center text-sm py-2.5">
            Browse agents
          </Link>
        </div>
      </main>
    </div>
  )
}
