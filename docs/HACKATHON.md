# Composing a Hackathon on the Agent Economy Kit

A deep guide for **organizers** (how to structure tracks + judging) and **participants** (where to
build and what to build). The thesis the whole event sits on:

> **Agents are a new kind of customer.** They transact at machine speed, in micro-amounts, with no
> human in the loop. This kit is a working agent economy — a seller agent sells a service for SOL;
> buyers (agent *or* human) pay per call, settled on-chain, coordinated by CoralOS. Participants build
> *what gets sold, who buys it, and how* — the payment rail is already done.

---

## Part 1 — What the kit handles (so nobody rebuilds it)

The hard, identical-for-everyone 80% is shipped and **proven live on devnet**:

| The kit owns | So participants never touch |
|---|---|
| On-chain payment + **reference-bound verification** (`validateTransfer`) | "how does an agent prove it paid" |
| The **HTTP 402 / Solana Pay** handshake | the payment protocol |
| **CoralOS coordination** (MCP sessions, threads, the puppet bridge) | multi-agent messaging plumbing |
| Two **front doors** — autonomous (agent→agent) + human checkout (Phantom) | wallet UX, the buyer/seller loop |
| Devnet setup, Docker, the demo UI, replay/mainnet guards | infra + security boilerplate |

A team gets to a working money-moving loop in ~20 minutes (`just dev`). Their hours then go entirely
into the **differentiated 20%** — their actual idea.

> The mental model: **`deliverService` is the body of a paid HTTP handler.** Anything you'd put behind
> a "pay to access this" endpoint, a participant puts there — and it's monetized on-chain for free.

---

## Part 2 — Where participants build (the fork points)

There are exactly four "edit here" surfaces. Memorize these; everything maps to one of them.

| # | Fork point | File | What it controls |
|---|-----------|------|------------------|
| **1** | **What's sold** | `coral-agents/seller-agent/src/service.ts → deliverService(request)` | the service — any API, on-chain read, computation, or LLM call returning a string |
| **2** | **What the buyer wants + how it decides** | `coral-agents/buyer-agent/src/{goal.ts, llm_buyer.ts}` | the autonomous agent's goal, budget, and pay/don't-pay logic (an LLM with a code-enforced budget) |
| **3** | **New agents** | drop a folder in `coral-agents/`, register in `examples/agent-economy/config/coral.toml` | broker, router, oracle, arbiter — turns buyer↔seller into a *swarm* |
| **4** | **New front doors** | `examples/agent-economy/bridge/server.ts` (+ its `web/`) | how humans/other systems enter the economy (Discord bot, CLI, a vertical UI) |

Two deeper surfaces for ambitious teams:

- **The runtime** — `packages/agent-runtime`: write a new `Strategy` (subclass `BaseStrategy`) or use
  `startCoralAgent` for a brand-new agent. This is the framework everything is built *on*. See
  `packages/agent-runtime/README.md`.
- **Smart contracts** — `examples/agent-economy/escrow/`: the optional Anchor escrow for *trustless*
  settlement (adds Rust). See its README for what to build on it.

---

## Part 3 — The build ladder (difficulty tiers)

Map a team's skill + ambition to a tier. Each is a complete, demo-able project.

### Tier 0 — Warm-up (15 min): sell something
Edit `deliverService` to return anything. Run the demo, watch a buyer pay for it on-chain. *Goal:
understand the loop.* Not a submission — a checkpoint everyone hits.

### Tier 1 — A real service (the most common submission)
A useful `deliverService` + a clean delivery. The seller becomes a real paid endpoint.
- *Build in:* fork point **1**.
- *Examples:* a Solana devnet wallet analyzer, a price/oracle agent, a translation agent, a "roast my
  wallet" agent, a gated dataset.

### Tier 2 — A smart autonomous buyer
Reshape the buyer's goal and decision logic — comparison-shopping, thresholds, arbitrage.
- *Build in:* fork point **2** (`goal.ts`, `llm_buyer.ts`).
- *Examples:* an agent that only buys when a price crosses a threshold; one that buys from *several*
  sellers and picks the cheapest; one that buys data, enriches it, and resells at a markup.

### Tier 3 — A multi-agent economy
Add agents so it's no longer 1↔1. This is the "agent economy" headline.
- *Build in:* fork point **3** (new agents + `coral.toml`).
- *Examples:* a **broker** that routes a request to specialist sellers; a **2-sided marketplace**
  (many sellers advertise, buyers discover + pay the best); a **pipeline** where money flows through
  three agents (raw data → enriched → report); a **judge/oracle** agent paid to verify another's work.

### Tier 4 — Trustless settlement / new mechanisms
The research-y tier — escrow, disputes, reputation, staking.
- *Build in:* `examples/agent-economy/escrow/` (+ a `Strategy` that uses it).
- *Examples:* an escrow with an **arbiter agent**; **streaming/milestone** payments; an **on-chain
  agent registry** with reputation; **slashing** for failed deliveries.

---

## Part 4 — What types of apps (the taxonomy)

Six categories. The Solana-native ones are the most on-thesis for a Solana event.

### A. On-chain / Solana data agents — **the standout category**
Sell **devnet on-chain data**, read from the free devnet RPC (no key, no real money).
- Wallet portfolio (`getBalance` + token accounts) · transaction explainer (`getTransaction`) ·
  token/mint info · NFT appraiser · network-stats agent · priority-fee oracle · a "watch this account"
  **subscription** (the runtime's `HeliusMonitorStrategy` already does account-change monitoring) ·
  an agent that **reads a deployed program's state** (e.g. the escrow PDA).
- *Why it wins a Solana hackathon:* it's an agent economy **on Solana, about Solana.**

### B. Market-data / oracle agents
Crypto prices and quotes (mainnet liquidity, read-only — no real funds): Jupiter swap quotes,
CoinGecko, DIA, Birdeye. An agent that *sells* a price feed other agents subscribe to.

### C. AI / inference agents — sell intelligence
Resell an LLM completion (`SERVICE=inference`): a code-gen/review agent (Codex/OpenAI), a summarizer,
a sentiment/classifier, an image generator, an "analyst" agent. *The buyer is also an LLM — so you can
build agents that buy reasoning from other agents.*

### D. Multi-agent economies — agents serving agents
Brokers, marketplaces, research pipelines, swarms, reputation systems. The most ambitious and most
differentiated — money flowing through *graphs* of agents.

### E. Human-facing products
The checkout front door is one consumer; build others: a polished vertical storefront, a Discord/Telegram
bot that pays agents, a CLI tool, a dashboard. "A human pays an AI agent for X" as a product.

### F. Trust & infrastructure
Escrow, disputes, subscriptions, on-chain registries, an x402 facilitator, monitoring/alerting agents.
The plumbing a *real* marketplace needs (see `docs/PRODUCTION_HARDENING.md`).

> Full API menu with free?/key?/devnet? flags: **`docs/APIS.md`**.

---

## Part 5 — For organizers: composing tracks

Pick 2–3 tracks that map cleanly to the fork points, so judging is legible.

| Track | Maps to | "A great entry is…" |
|-------|---------|---------------------|
| **Agents serving agents** | Tiers 2–3 | a multi-agent system where agents autonomously buy from each other |
| **Agent-accessible services** | Tier 1 | a genuinely useful paid service (esp. Solana on-chain data) any agent can buy |
| **Consumer agent apps** | fork point 4 | a polished human→agent product on the checkout door |
| **(Stretch) Trustless settlement** | Tier 4 | escrow / reputation / a new on-chain mechanism |

**Logistics that make it run smoothly:**
- **Devnet only** — zero real-money risk; participants fund wallets free at the faucet.
- **Prereqs to announce:** Docker, Node 20+, a Phantom wallet, and (optional) an Anthropic *or*
  OpenAI key for AI agents. The on-chain loop needs no LLM key.
- **The 20-minute on-ramp:** `git clone … && just dev`, then fund the two printed wallets at
  faucet.solana.com (GitHub sign-in — the only way; CLI airdrops are gated).
- **A "hello economy" checkpoint:** require every team to first change `deliverService` and watch a
  payment settle — it de-risks the rest of their day.

---

## Part 6 — Judging criteria (grounded in the kit)

A strong submission, in rough priority:

1. **It actually settles on-chain.** Real devnet transactions with Explorer links — not a mock. (The
   kit makes this the *easy* part, so there's no excuse.)
2. **The service is differentiated.** Is `deliverService` (or the agent graph) genuinely useful or
   novel — not just the default Jupiter quote?
3. **Agentic depth.** Does an *agent* decide and act autonomously (the buyer's logic, a multi-agent
   design), or is it just a scripted call?
4. **Demo-ability.** Can they *show* it? The two-tab UI (Autonomous + Checkout) is the built-in demo —
   strong teams extend it or pipe their flow through it.
5. **On-thesis for Solana.** Bonus for using Solana-native data/mechanisms (Part 4A) or a smart
   contract (Tier 4).

> Anti-pattern to flag: a team that spent the weekend rebuilding payment verification instead of
> building their service. Point them at the fork points early.

---

## Part 7 — A participant's path (a weekend)

```
Hour 0–1    clone → `just dev` → fund wallets → watch the demo settle a payment
Hour 1–2    pick a fork point; change deliverService to your service (Tier 1)
Hour 2–8    build the real thing — your service / your agent's logic / your agent graph
Hour 8–20   depth: multi-agent, a second front door, polish the demo UI
Hour 20–24  record the demo: show the on-chain settlement + your differentiated bit
```

The team that wins isn't the one that understood CoralOS internals — it's the one whose **agent does
something genuinely useful and gets paid for it on-chain**, shown live.

---

## Part 8 — Constraints & gotchas (tell participants up front)

- **Devnet only.** All payments are free test SOL; `setRpc` rejects mainnet unless `ALLOW_MAINNET=1`.
- **Funding is manual.** faucet.solana.com, **GitHub sign-in** — the only way (CLI/RPC airdrops are
  gated). Fund both `.env` wallets *and* your Phantom wallet (the checkout door uses Phantom).
- **Any API works**, with caveats: keyed APIs need the key in the **seller's** env; **paid** APIs cost
  the seller real money per call (fine on devnet — you're subsidizing); huge/binary results → return a
  **URL**, not the bytes; a flaky upstream = a flaky service.
- **LLM is Anthropic by default.** OpenAI/Codex is a small swap (see `docs/APIS.md`); the payment loop
  works with no LLM key at all.
- **Docker required** for the CoralOS path; `examples/agent-economy/quickstart/` is the no-Docker
  fallback (bare-metal 402).

---

## Where to read next

| To… | Read |
|-----|------|
| run it | root `README.md` · `examples/agent-economy/README.md` |
| pick a service/API | `docs/APIS.md` |
| understand an agent | `coral-agents/*/README.md` |
| extend the runtime | `packages/agent-runtime/README.md` |
| add a smart contract | `examples/agent-economy/escrow/README.md` |
| take it to production | `docs/PRODUCTION_HARDENING.md` · `.claude/SECURITY_REVIEW.md` |
