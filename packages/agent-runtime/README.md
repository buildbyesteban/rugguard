# @pay/agent-runtime

The CoralOS MCP client every agent in this kit is built on. It connects an agent to a CoralOS
session and hands you the four messaging verbs — so you only write *behavior*.

```ts
import { startCoralAgent } from '@pay/agent-runtime'
```

The `coral-agents/` agents depend on it via a local `file:` link. Build its `dist` before dependents:
`npm install && npm run build` (also `npm run typecheck`, `npm test`).

## What it gives you

| Export | What it is |
|--------|-----------|
| `startCoralAgent(config, run)` | the entrypoint — connects an agent to CoralOS and hands you a `ctx` |
| `ctx` | `waitForMention`, `waitForMentionInThread`, `waitForAgent`, `reply`, `send`, `createThread` |
| `CoralMcpAgent` | the MCP client underneath (StreamableHTTP transport, tool discovery) |
| `solanaConnection(url?)` / `assertDevnet` | devnet-guarded `Connection` for payment code — throws on a mainnet RPC unless `ALLOW_MAINNET=1` |

`coral_mcp.ts` (the client), `coral_mcp_server.ts` (`startCoralAgent`), and `solana.ts` (the devnet
guard). Payments settle agent-side in Solana code — the runtime never holds a keypair, it just keeps
your payment code off mainnet.

## How to use it

You write the loop; the runtime handles spawning, connecting, and routing:

```ts
await startCoralAgent({ agentName: 'seller-agent' }, async (ctx) => {
  while (true) {
    const m = await ctx.waitForMention()          // a CoralOS @mention (or null on timeout)
    if (m) await ctx.reply(m, 'PAYMENT_REQUIRED …')
  }
})
```

`ctx.waitForMentionInThread(threadId)` is the same but scoped to one thread — for agents juggling
several at once (e.g. the broker shopping multiple sellers; see `docs/SWARM.md`).
`ctx.waitForAgent(name)` blocks until a specific agent comes online before you send it work.

## Extend it

| Want… | Do this |
|---|---|
| new data to sell | edit `deliverService` in `coral-agents/seller-agent` |
| new autonomous behavior | `startCoralAgent({ agentName }, run)` — a new agent |
| a new front door | drive the session from outside (see `examples/agent-economy/bridge`) |

> You build *on* the runtime — you rarely edit it. The job of `startCoralAgent` is to make your
> behavior "just work" against CoralOS, leaving payment to your Solana code.

For exact signatures, read `src/coral_mcp.ts` (the MCP client) and `src/coral_mcp_server.ts`
(`startCoralAgent` + the `ctx` it builds) — both small and commented.
