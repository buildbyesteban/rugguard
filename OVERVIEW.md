# The Whole Repo, Explained — and How to Win a Hackathon With It

> **One sentence:** this repo is a working **agent economy** — a *seller* program offers a service for
> money, a *buyer* (an AI agent **or** a human) pays for it with a real on-chain Solana transaction,
> and the seller checks the blockchain to confirm it got paid before delivering. The hard plumbing is
> done; you bolt your idea onto one function.

This document is the map. It explains every moving part in plain language (but with the real terms, so
you can talk to judges), then shows exactly where you plug in your hackathon project.

If you only read one section, read [Part 7 — Your Hackathon Playbook](#part-7--your-hackathon-playbook).

---

## Part 0 — The 60-second mental model

Imagine a vending machine that:

1. You walk up to and say *"I want a soda."*
2. It replies *"That'll be $1 — pay to this exact slot, with this exact ticket number."*
3. You pay. The payment is public and permanent (it's on a blockchain).
4. The machine **looks at the public record itself**, confirms your dollar landed with the right
   ticket number, and **then** drops the soda.

Now make the customer a piece of software that can decide on its own whether the soda is worth $1.
That's the "agent economy." This repo is that vending machine, the customer, and the wiring between
them — all real, all running on Solana's free test network.

The key insight the whole event sits on:

> **Agents are a new kind of customer.** They buy at machine speed, in tiny amounts, 24/7, with no
> human clicking "confirm." Build the thing they buy.

---

## Part 1 — The vocabulary (jargon, decoded)

You'll see these words everywhere. Here's each one ELI5, with the real term kept so you sound fluent.

| Term                              | ELI5                                                                     | The real meaning                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Agent**                   | a little robot worker that can talk and make decisions                   | a long-running program (often LLM-driven) that joins a session and acts autonomously                |
| **Agent economy**           | robots (and people) buying/selling from each other, paying automatically | software that transacts per-request with on-chain settlement, no human approval step                |
| **Solana**                  | a fast, cheap blockchain (public ledger of who-paid-whom)                | a high-throughput L1; we use it for payments                                                        |
| **Devnet**                  | the*practice* version of Solana with fake money                        | Solana's free test cluster — identical mechanics to mainnet, play SOL                              |
| **SOL / lamports**          | the coin / its pennies (1 SOL = 1,000,000,000 lamports)                  | the native token; amounts on-chain are in lamports                                                  |
| **Wallet / keypair**        | your account + the secret password that signs for it                     | a public key (address) + private key used to sign transactions                                      |
| **Solana Pay**              | a standard "payment link" format, like a QR code for money               | `solana:` URLs encoding *recipient + amount + reference*                                        |
| **HTTP 402**                | the long-forgotten "Payment Required" web error code, finally used       | the seller answers a request with "pay first" — the payment handshake                              |
| **Reference**               | a unique ticket number stapled to one payment                            | a one-time public key written into the transfer so a payment proves*this* order                   |
| **Signature (sig)**         | the receipt ID for a transaction                                         | the transaction's unique on-chain identifier; the buyer sends it as proof of payment                |
| **On-chain verification**   | the seller checks the public ledger instead of trusting your word        | `validateTransfer` / `getTransaction` confirm recipient + amount + reference                    |
| **CoralOS / coral-server**  | the group chat + switchboard the robots talk in                          | an**MCP** coordination server: sessions, threads, messages. *It moves messages, not money.* |
| **MCP**                     | the shared language the robots speak                                     | Model Context Protocol — a standard for tools/agents to talk                                       |
| **Phantom**                 | the browser wallet a human clicks "Pay" in                               | a popular Solana wallet browser extension                                                           |
| **user-proxy / Puppet API** | a stand-in robot so a human can join the robot chat                      | a placeholder agent the bridge drives, since a human isn't an MCP agent                             |
| **Escrow**                  | a locked deposit box released only on delivery                           | the optional Anchor smart contract for*trustless* settlement                                      |
| **Anchor**                  | the toolkit for writing Solana smart contracts in Rust                   | the framework`examples/.../escrow` uses                                                           |

---

## Part 2 — The one diagram that explains everything

This is the **payment cycle**. Every hackathon project is a variation on it. Each arrow is a real
message; the middle step is a real devnet transaction you can open in a block explorer.

```
  buyer (agent OR human)  ──"request <query>"──────────────────────▶  seller
                                                                       │
  seller  ──"PAYMENT_REQUIRED  amount=…  reference=…  url=solana:…"──◀─┘
   │  (HTTP 402: "pay first; here's who/how-much/which-ticket")
   ▼
  buyer pays the solana: URL on devnet  (keypair signs, OR Phantom popup)  ──▶  on-chain tx (sig)
   │
   └──"paid <sig> reference=…"────────────────────────────────────▶  seller
                                                                       │
                          seller calls getTransaction(sig) / validateTransfer:
                          ✔ right recipient?  ✔ right amount?  ✔ right reference?
                                                                       │
  seller  ──"DELIVERED <your service's result>"─────────────────────◀─┘
```

**Why the "reference" matters (the clever bit):** the seller doesn't just check "did someone send me
1 SOL?" — anyone could replay an old payment. It checks "did this payment carry *the unique ticket I
issued for this order*?" That makes a payment proof **non-transferable**: a payment for order A can't
satisfy order B, and a stolen signature won't validate against a different reference. (See
[`payment.ts`](coral-agents/seller-agent/src/payment.ts) — `validateTransfer`.) A separate
**ReplayGuard** stops the *same* sig being redeemed twice.

> **CoralOS does NOT touch the money.** It's purely the message bus / chat room. Payment settles
> agent-side in plain SOL. (CoralOS has a half-built native payment token upstream — the kit
> deliberately doesn't use it.)

---

## Part 3 — The repo, folder by folder

Top-level layout, in the order you'll actually care about it:

```
pay/
├─ examples/agent-economy/   ← THE TRACK. Run this. Build here.
│  ├─ autonomous/            ← front door #1: agent → agent (an LLM buyer pays a seller)
│  ├─ bridge/                ← front door #2 server: injects a human's order + serves the UI
│  ├─ web/                   ← the React demo UI (Autonomous / Checkout / Swarm tabs)
│  ├─ config/coral.toml      ← which agents coral-server launches (wallet-free config)
│  ├─ quickstart/            ← NO-DOCKER version: same loop as 2 plain Node processes over HTTP 402
│  └─ escrow/                ← OPTIONAL Rust smart contract (trustless settlement)
│
├─ coral-agents/             ← the agents coral-server launches in Docker
│  ├─ seller-agent/          ← ★ sells a service. FORK service.ts → deliverService()
│  ├─ buyer-agent/           ← the autonomous buyer (+ the LLM decision-maker)
│  ├─ broker/                ← a "swarm" agent: routes a request to many sellers, picks cheapest
│  ├─ echo-agent/            ← minimal agent (a connectivity hello-world)
│  ├─ seller-cheap/ -premium ← extra sellers for the swarm demo
│  └─ user_proxy/            ← Python stand-in so a human can be in a coral session
│
├─ packages/agent-runtime/   ← the framework everything is built on (TypeScript library)
│  └─ src/                   ← AgentManager, Strategy, MessageBus, SharedState, WorkflowEngine,
│                              the CoralOS MCP client, and ready-made Strategies
│
├─ scripts/                  ← setup.js (makes wallets), doctor.js (health check), smoke tests
├─ docs/                     ← the deep guides (HACKATHON, APIS, REACT_FRONTEND, SWARM, …)
├─ docker-compose.yml        ← brings up coral-server + the bridge
├─ build-agents.sh           ← builds the agent Docker images
└─ justfile                  ← one-liners: `just dev`, `just doctor`, `just auto`, `just down`
```

### 3a. `packages/agent-runtime` — the engine

The CoralOS MCP client every agent imports. Two modules (exported from
[`index.ts`](packages/agent-runtime/src/index.ts)):

- **`startCoralAgent(config, run)`** — the entrypoint a Docker agent calls to join a CoralOS session.
  It reads the injected `CORAL_CONNECTION_URL`, connects, and hands your `run` a `ctx` with the four
  verbs (`waitForMention`, `reply`, `send`, `createThread`, plus `waitForMentionInThread` /
  `waitForAgent`). *Write a new agent = call this with your loop.*
- **`CoralMcpAgent`** — the MCP client underneath: StreamableHTTP transport, dynamic tool discovery,
  and `parseMention` (normalizes CoralOS's response shapes). The run loop respects an `AbortSignal`.
- **`solanaConnection` / `assertDevnet`** — a devnet-guarded `Connection` factory the agents use for
  every payment; it refuses a mainnet RPC unless `ALLOW_MAINNET=1`.

That's the whole runtime — the CoralOS client plus a devnet safety guard. Payments themselves settle
in each agent's own Solana code (`payment.ts` / `wallet.ts`); the runtime never holds a keypair.

> ⚠️ Build order: `coral-agents` and `examples` depend on this package via `file:` links, so run
> `npm run build` in `packages/agent-runtime` first (the dist must exist).

### 3b. `coral-agents` — the actual workers

- **`seller-agent`** ← *the star.* Speaks `request → PAYMENT_REQUIRED → paid → DELIVERED`.
  - [`payment.ts`](coral-agents/seller-agent/src/payment.ts): `generatePaymentUrl` (mints the
    Solana Pay URL + unique reference) and `verifyPayment` (on-chain `validateTransfer`).
  - [`replay.ts`](coral-agents/seller-agent/src/replay.ts): the `ReplayGuard` — one sig, one redemption.
  - [`service.ts`](coral-agents/seller-agent/src/service.ts): **`deliverService()` — the fork point.**
    Out of the box it can return a Jupiter swap quote, a CoinGecko price, news headlines, or a **Claude
    LLM completion** (`SERVICE=inference`). You replace the body with your thing.
- **`buyer-agent`** — the autonomous customer. `goal.ts` (what it wants), `llm_buyer.ts` (an LLM
  *decides* whether to pay), and crucially [`guard.ts`](coral-agents/buyer-agent/src/guard.ts): the
  budget + recipient rules are **enforced in code, not in the prompt** — so a prompt-injection in
  fetched data can't make the buyer overspend or pay a stranger. (Real agent-security thinking — judges
  notice.)
- **`broker`** — a swarm agent: asks several sellers for quotes, parses each `PAYMENT_REQUIRED`, and
  [`pickCheapest`](coral-agents/broker/src/logic.ts). This is the template for "money flowing through
  a graph of agents."
- **`echo-agent`** — the minimal MCP agent; use it to confirm connectivity.
- **`user_proxy`** (Python, ~40 lines) — the human's stand-in agent. The bridge drives it via coral's
  Puppet API so a human can appear inside an agent session.

### 3c. `examples/agent-economy` — the runnable track

- **`autonomous/`** — `npm start` here runs the agent→agent loop end to end.
- **`bridge/`** — an Express server: takes a human's order over HTTP, injects it into a coral session
  *as* `user-proxy`, relays the seller's reply, and **serves the Phantom checkout UI on `:3010`**.
- **`web/`** — the Vite + React demo UI with three tabs (Autonomous, Checkout, Swarm). This is your
  built-in demo; strong teams extend it.
- **`quickstart/`** — *no Docker, no coral.* The same pay-per-call loop as two bare Node processes
  talking plain HTTP 402. Great for understanding the protocol nakedly, or for a fast offline hack.
- **`escrow/`** — the **optional** Anchor (Rust) smart contract. The base track is *pay-first* (buyer
  trusts seller to deliver). Escrow removes that trust: buyer **deposits** into a per-order PDA, seller
  is paid only on **release** (buyer confirms delivery), buyer can **refund** after a **deadline** if
  nothing was delivered. See [`lib.rs`](examples/agent-economy/escrow/programs/escrow/src/lib.rs) — note
  the security posture: `init` (not `init_if_needed`), PDA seeds bind buyer + reference, `has_one`
  checks, `close = buyer`, checked math.

---

## Part 4 — How a request actually flows (two front doors, one seller)

The whole point: **two ways in, same seller, same protocol, same on-chain settlement.**

**Front door #1 — Autonomous (agent → agent):**

```
buyer-agent (LLM decides "yes, worth it") → seller-agent over a CoralOS thread → pays with its keypair
```

Run it: `cd examples/agent-economy/autonomous && npm start`, then `docker logs -f buyer-agent`.

**Front door #2 — Checkout (human → agent):**

```
you, in a browser → bridge (:3010) → injects order as user-proxy → seller-agent → you click "Pay" in Phantom
```

Run it: `docker compose up -d bridge`, open `http://localhost:3010` with Phantom set to **Devnet**.

Both paths hit the **same `deliverService`** and the **same on-chain verification**. That's the elegant
part — you build your service once and it's sold to robots and humans alike.

---

## Part 5 — Getting it running (the 20-minute on-ramp)

Everything is **devnet** and **free**. You bring your own keys in a local `.env` (none are in the repo).

**Prerequisites:** Docker Desktop, Node 20+, a Phantom wallet (set to Devnet), and *optionally* an
Anthropic API key (only needed for the LLM decision step / the `inference` service — the payment loop
works without it).

**One-shot (needs [`just`](https://github.com/casey/just) + Docker):**

```sh
just dev      # generate wallets + build images + start coral & bridge
just doctor   # health check: Docker, Node, funded wallets, a live end-to-end payment
```

**Manual, if you don't have `just`:**

```sh
cd scripts && npm install && cd ..
node scripts/setup.js              # generates buyer + seller keypairs → .env, prints 2 addresses

#  ▶ FUND both printed addresses at  https://faucet.solana.com  (GitHub sign-in — the ONLY way;
#    CLI/RPC airdrops are gated). Also fund your Phantom wallet for the checkout door.
#  ▶ (optional) add  ANTHROPIC_API_KEY=sk-ant-…  to .env

bash build-agents.sh               # build the agent images coral-server launches
docker compose up -d coral bridge  # stock coral-server + the checkout bridge (:3010)
```

Then pick a door (Part 4). **No Docker?** Use `examples/agent-economy/quickstart/`.

Gotchas: fund **both** `.env` wallets *and* Phantom; faucet needs GitHub sign-in; see
[`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) for Docker/ports/Windows-`just` issues.

---

## Part 6 — The four fork points (where you build)

There are exactly **four "edit here" surfaces**. Every hackathon idea maps to one (or a combination).

| #           | Fork point                                      | File(s)                                                                                   | What it controls                                                                         |
| ----------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **1** | **What's sold**                           | `coral-agents/seller-agent/src/service.ts → deliverService(request)`                   | the service: any API call, on-chain read, computation, or LLM call that returns a string |
| **2** | **What the buyer wants + how it decides** | `coral-agents/buyer-agent/src/{goal.ts, llm_buyer.ts}`                                  | the autonomous agent's goal, budget, and pay/don't-pay logic                             |
| **3** | **New agents (a swarm)**                  | new folder in`coral-agents/` + register in `examples/agent-economy/config/coral.toml` | brokers, routers, oracles, arbiters — turns 1↔1 into a graph                           |
| **4** | **New front doors**                       | `examples/agent-economy/bridge/server.ts` (+ `web/`)                                  | how humans/other systems enter: Discord bot, CLI, a vertical UI                          |

> **The mental model:** `deliverService` is **the body of a paid HTTP handler.** Anything you'd put
> behind a "pay to access this" endpoint goes there — and it's monetized on-chain for free.

Two deeper surfaces for ambitious teams: write a new **`Strategy`** in `packages/agent-runtime`, or
build on the **escrow** contract for trustless settlement.

---

## Part 7 — Your Hackathon Playbook

### The build ladder (pick your tier)

- **Tier 0 — Warm-up (15 min):** edit `deliverService` to return *anything*, run the demo, watch a
  buyer pay for it on-chain. Not a submission — the checkpoint that de-risks your whole weekend.
- **Tier 1 — A real service (most common winner):** a genuinely useful `deliverService`. *Fork point 1.*
  Examples: a Solana wallet analyzer, a price/oracle agent, a translator, a "roast my wallet" agent, a
  gated dataset.
- **Tier 2 — A smart autonomous buyer:** reshape the buyer's goal + decision logic. *Fork point 2.*
  Examples: buys only when a price crosses a threshold; comparison-shops several sellers; buys data,
  enriches it, resells at a markup.
- **Tier 3 — A multi-agent economy (the headline):** add agents so it's no longer 1↔1. *Fork point 3.*
  Examples: a **broker** routing to specialist sellers; a 2-sided marketplace; a 3-agent pipeline (raw
  → enriched → report); a **judge/oracle** agent paid to verify another's work.
- **Tier 4 — Trustless settlement / new mechanisms (research-y):** escrow, disputes, reputation,
  staking. Build on `escrow/` + a Strategy. Examples: escrow with an **arbiter agent**;
  streaming/milestone payments; an on-chain agent registry with reputation; slashing on failed delivery.

### What to build (the taxonomy)

- **A. On-chain / Solana data agents — the standout for a Solana event.** Sell devnet on-chain data
  from the free RPC: wallet portfolio, transaction explainer, token/mint info, NFT appraiser,
  priority-fee oracle, a "watch this account" **subscription** (the `HeliusMonitorStrategy` already does
  account-change monitoring), an agent that reads a deployed program's state. *It's an agent economy
  **on Solana, about Solana.***
- **B. Market-data / oracle agents.** Crypto prices/quotes (read-only): Jupiter, CoinGecko, Birdeye.
  An agent that *sells* a feed others subscribe to.
- **C. AI / inference agents — sell intelligence.** Resell an LLM completion (`SERVICE=inference`):
  code review, summarizer, classifier, image gen, an "analyst." *The buyer is also an LLM — agents
  buying reasoning from agents.*
- **D. Multi-agent economies.** Brokers, marketplaces, research pipelines, reputation systems — money
  through graphs. The most differentiated.
- **E. Human-facing products.** A polished storefront, a Discord/Telegram bot that pays agents, a CLI,
  a dashboard. "A human pays an AI agent for X."
- **F. Trust & infrastructure.** Escrow, disputes, subscriptions, on-chain registries, monitoring
  agents — the plumbing a real marketplace needs.

> Full API menu (free? / key? / devnet?): [`docs/APIS.md`](docs/APIS.md).

### What judges reward (in priority order)

1. **It actually settles on-chain** — real devnet txs with Explorer links, not a mock. The kit makes
   this the *easy* part, so there's no excuse.
2. **The service is differentiated** — not just the default Jupiter quote.
3. **Agentic depth** — does an *agent* decide and act autonomously, or is it a scripted call?
4. **Demo-ability** — can you *show* it? Use/extend the built-in tabbed UI.
5. **On-thesis for Solana** — bonus for Solana-native data (category A) or a smart contract (Tier 4).

> **Anti-pattern judges flag:** a team that spent the weekend rebuilding payment verification instead
> of building their service. Don't. That's done. Build your idea.

### A weekend, hour by hour

```
Hour 0–1    clone → just dev → fund wallets → watch the demo settle a payment
Hour 1–2    pick a fork point; change deliverService to your service (Tier 1)
Hour 2–8    build the real thing — your service / your agent's logic / your agent graph
Hour 8–20   depth: multi-agent, a second front door, polish the demo UI
Hour 20–24  record the demo: show the on-chain settlement + your differentiated bit
```

The team that wins isn't the one that understood CoralOS internals — it's the one whose **agent does
something genuinely useful and gets paid for it on-chain, shown live.**

---

## Part 8 — Constraints & gotchas (read before you build)

- **Devnet only.** All payments are free test SOL; agent payment code uses `solanaConnection()`,
  which refuses a mainnet RPC unless `ALLOW_MAINNET=1` (and defaults to devnet). Never put a funded
  mainnet keypair in `.env`.
- **Funding is manual.** faucet.solana.com, GitHub sign-in — the only way. Fund both `.env` wallets
  *and* your Phantom wallet.
- **Any API works**, with caveats: keyed APIs need the key in the **seller's** env; paid APIs cost the
  seller real money per call (fine on devnet — you're subsidizing); huge/binary results → return a
  **URL**, not the bytes; a flaky upstream = a flaky service.
- **LLM is Anthropic by default.** OpenAI/Codex is a small swap in `llm_buyer.ts` (see `docs/APIS.md`);
  the payment loop needs no LLM key at all.
- **Docker required** for the CoralOS path; `quickstart/` is the no-Docker fallback.
- **The CoralOS run loop honors its `AbortSignal`** (`runLoop`; `startCoralAgent` handles
  SIGINT/SIGTERM). **Build `packages/agent-runtime` first** (others depend on its dist).

---

## Part 9 — Where to read next

| To…                                        | Read                                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| run it                                      | root[`README.md`](README.md) · [`examples/agent-economy/README.md`](examples/agent-economy/README.md)                       |
| plan a hackathon (organizer or participant) | [`docs/HACKATHON.md`](docs/HACKATHON.md)                                                                                    |
| pick a service/API                          | [`docs/APIS.md`](docs/APIS.md)                                                                                              |
| build a React frontend e2e                  | [`docs/REACT_FRONTEND.md`](docs/REACT_FRONTEND.md) · [`docs/EXPANDING_FRONTEND.md`](docs/EXPANDING_FRONTEND.md)             |
| build a multi-agent swarm                   | [`docs/SWARM.md`](docs/SWARM.md)                                                                                            |
| understand an agent                         | `coral-agents/*/README.md`                                                                                               |
| extend the runtime                          | [`packages/agent-runtime/README.md`](packages/agent-runtime/README.md)                                                      |
| add a smart contract                        | [`examples/agent-economy/escrow/README.md`](examples/agent-economy/escrow/README.md)                                        |
| go past a devnet demo                       | [`docs/PRODUCTION_HARDENING.md`](docs/PRODUCTION_HARDENING.md) · [`.claude/SECURITY_REVIEW.md`](.claude/SECURITY_REVIEW.md) |
| fix a snag                                  | [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)                                                                                  |

---

*This repo's headline path is `examples/agent-economy/` on stock coral-server. The core stack is
Node.js/TypeScript throughout (plus one ~40-line Python puppet) — no Rust required. The only Rust is
the optional escrow add-on. License: MIT.*
