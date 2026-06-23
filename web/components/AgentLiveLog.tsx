'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/coral'
import type { AgentAction } from '../../../typescript_sdk/sdk/src/types'

const TYPE_COLOR: Record<string, string> = {
  'payment-received':    'text-solana-green',
  'data-delivered':      'text-solana-green',
  'coral-mention':       'text-brand',
  'coral-url-generated': 'text-brand',
  'strategy-start':      'text-blue-400',
  'poll-tick':           'text-gray-600',
}

function colorFor(actionType: string): string {
  return TYPE_COLOR[actionType] ?? 'text-gray-400'
}

export function AgentLiveLog({ agentId }: { agentId: string }) {
  const [actions, setActions] = useState<AgentAction[]>([])

  useEffect(() => {
    const poll = async () => {
      try {
        const client = getClient()
        const state = await client.getAgent(agentId)
        if (state?.actions) {
          setActions([...state.actions].reverse().slice(0, 8))
        }
      } catch {
        // coral-server not running — ignore silently
      }
    }

    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [agentId])

  if (actions.length === 0) {
    return <p className="text-xs text-gray-600 font-mono">Waiting for agent activity…</p>
  }

  return (
    <div className="space-y-1 font-mono text-xs">
      {actions.map((a, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-gray-600 shrink-0">
            {new Date(a.timestamp).toLocaleTimeString()}
          </span>
          <span className={`shrink-0 ${colorFor(a.action_type)}`}>
            {a.action_type}
          </span>
          <span className="text-gray-500 truncate">
            {a.details.slice(0, 60)}
          </span>
        </div>
      ))}
    </div>
  )
}
