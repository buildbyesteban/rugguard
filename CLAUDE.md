# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A TypeScript-first starter kit for a Solana **agent economy**: a seller agent sells a service for SOL;
buyers — another agent (autonomous) or a human (Phantom checkout) — request it over **CoralOS** (MCP),
pay on-chain, and the seller verifies the payment and delivers. One track, two front doors. The core
stack is Node.js/TypeScript throughout (plus one ~40-line Python puppet) — no Rust. There is **one
optional Rust add-on**: an Anchor escrow under `examples/agent-economy/escrow/` (the trustless-settlement
upgrade), clearly marked as opt-in and not needed by the core track.

## Repo Layout

| Directory | Purpose |
|-----------|---------|
| `examples/agent-economy/` | **The track.** `autonomous/` (agent↔agent starter), `bridge/` (human→user-proxy checkout — Express bridge + self-served Phantom UI), `config/coral.toml` (wallet-free MCP config), `quickstart/` (no-Docker bare-metal 402) |
| `coral-agents/` | Agents coral-server launches: `seller-agent` (fork `service.ts`), `buyer-agent`, `echo-agent` (TypeScript); `user_proxy` (Python — the human's session stand-in, driven via the puppet API) |
| `packages/agent-runtime/` | TypeScript agent runtime: `AgentManager`, `Strategy`, `MessageBus`, `SharedState`, `WorkflowEngine`, CoralOS MCP client, Solana Pay strategies |
| `scripts/` | `setup.js` (wallet generation) + smoke tests |
| `docs/`, `.claude/` | Design docs + the `AGENT_ECONOMY_RESTRUCTURE.md` plan (gates G1–G3), `PRODUCTION_HARDENING.md`, `SECURITY_REVIEW.md` |

The headline (and only) path is `examples/agent-economy/` on stock coral-server. CoralOS is the MCP
coordination layer only — payments settle agent-side in SOL (no coral-server wallet, no native x402).

## Commands

### Run the economy (requires Docker)

```sh
node scripts/setup.js                                  # generate + fund devnet wallets → .env
bash build-agents.sh                                   # build seller/buyer/user-proxy images
docker compose up -d coral bridge                      # coral-server + the human-checkout bridge
cd examples/agent-economy/autonomous && npm start      # autonomous (agent → agent)
# open http://localhost:3010                           # human checkout (Phantom), served by the bridge
```

### packages/agent-runtime (agent runtime)

```sh
cd packages/agent-runtime && npm install
cd packages/agent-runtime && npm run typecheck
cd packages/agent-runtime && npm test
cd packages/agent-runtime && npm run build   # dependents (coral-agents, examples) need its dist
```

### Typecheck / test the economy

```sh
cd coral-agents/seller-agent && npm install && npm run typecheck && npm test   # incl. replay + payment tests
cd examples/agent-economy/bridge && npm install && npm run smoke               # headless human-path check (coral must be up)
```

## Architecture

### packages/agent-runtime

The CoralOS MCP client every agent is built on. Two modules:

- **`coral_mcp.ts` / `CoralMcpAgent`** — the MCP client: StreamableHTTP transport, dynamic tool
  discovery, and the four verbs (`waitForMention`, `sendMessage`, `createThread`, `waitForAgent`).
  `parseMention` normalizes CoralOS's response shapes (tested in `coral_mcp.test.ts`).
- **`coral_mcp_server.ts` / `startCoralAgent`** — the entrypoint a Docker agent calls to join a
  CoralOS session; reads the injected `CORAL_CONNECTION_URL` and hands your `run` a `ctx`.

The runtime is purely coordination — payments settle agent-side in each agent's Solana code.

### coral-agents (what coral-server launches)

- `seller-agent` — speaks `request → PAYMENT_REQUIRED → paid → DELIVERED`; binds payments to a unique
  Solana Pay **reference** (`payment.ts` `validateTransfer`) + a `ReplayGuard`. Fork point: `service.ts → deliverService()`.
- `buyer-agent` — autonomous buyer (`index.ts`) + the LLM buyer (`llm_buyer.ts`, code-enforced budget + recipient binding).
- `echo-agent` — minimal MCP agent (connectivity check).
- `user_proxy` — Python puppet; the human's session stand-in, driven by the bridge via the puppet API.

### examples/agent-economy/bridge

Express server that injects a human's order into a CoralOS session *as* `user-proxy` (puppet API),
relays the seller's reply, and **self-serves the Phantom checkout UI** (`web/index.html`) at `:3010`.
Reads replies from the session's extended state (the puppet API is send-only).

## Key Constraints

- **The CoralOS run loop should respect its `AbortSignal`** — `CoralMcpAgent.runLoop(handler, signal)` checks `signal.aborted`; `startCoralAgent` wires SIGINT/SIGTERM to a clean disconnect.
- **coral-server launches agents via the Docker socket** — build the agent images before `docker compose up`.
- **Devnet only** — agent payment code builds its `Connection` via `solanaConnection()` (`@pay/agent-runtime`), which throws on a mainnet RPC unless `ALLOW_MAINNET=1`; it defaults to `https://api.devnet.solana.com`. Never put a funded mainnet keypair in `.env`.
- **The `coral-agents` / `examples` packages depend on `@pay/agent-runtime` via `file:` deps** — run `npm run build` in `packages/agent-runtime` first so the dist exists.
