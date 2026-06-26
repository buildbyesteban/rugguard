# Runtime Cleanup — delete the unused half

> **Goal:** `packages/agent-runtime` ships a generic agent framework (`AgentManager`,
> `Strategy`, `MessageBus`, `SharedState`, `WorkflowEngine`, six strategies) that **no agent or
> example in the track imports**. It's a leftover from an earlier Rust port (see the
> *"Mirrors the Rust …"* comments). This document removes it completely, leaving a runtime that is
> exactly what the economy uses: the CoralOS MCP client.
>
> **Net effect:** delete **1,619 lines** (12 source files + 4 test files), keep **419 lines**
> (2 modules + index), refactor 1 agent file to cut its last tendril into the framework, and add the
> one test that was missing on the code that actually runs.

---

## Why this is safe

The dependency graph was traced before writing this. Across `coral-agents/`, `examples/`, and
`scripts/`, the **only** imports from `@pay/agent-runtime` are:

| Imported symbol | By |
|---|---|
| `startCoralAgent` | all 4 agents (`seller`, `buyer`, `broker`, `echo`) |
| `BaseStrategy`, `MutableAgentState`, `untilAborted` | **only** `buyer-agent/src/llm_buyer.ts` |
| `CoralMcpAgent` | `packages/agent-runtime/examples/coral_mcp_example.ts` |

A repo-wide grep for `AgentManager|MessageBus|SharedState|WorkflowEngine|CoralServerSync|*Strategy`
returns **zero** non-test hits. Everything in the delete set below is imported by nothing but its own
tests. The single `BaseStrategy` consumer — `LLMBuyerStrategy` — is **never instantiated** anywhere
(only its `parse402` helper is used/tested), so it can be decoupled from the framework without
behaviour change.

---

## The decision

### KEEP (the runtime's real surface — 419 lines)

```
packages/agent-runtime/src/coral_mcp.ts          CoralMcpAgent (MCP client)           293
packages/agent-runtime/src/coral_mcp_server.ts   startCoralAgent + CoralAgentContext  100
packages/agent-runtime/src/index.ts              public exports (rewritten below)      26
packages/agent-runtime/examples/coral_mcp_example.ts   (uses only CoralMcpAgent)
```

### DELETE (the unused framework — 1,619 lines)

**Source (12 files):**

```
src/agent.ts            Agent                       (only used by manager.ts — deleted)
src/manager.ts          AgentManager                unused
src/message_bus.ts      MessageBus                  unused
src/shared_state.ts     SharedState                 unused
src/workflow.ts         WorkflowEngine              unused
src/sync.ts             CoralServerSync             unused
src/role.ts             AgentRole, getPermissions   (only used by agent/manager — deleted)
src/log.ts              log                         exported, used nowhere
src/types.ts            AgentState, Workflow, …     (only used by strategy/agent — deleted)
src/strategy.ts         Strategy, BaseStrategy, …   (only used by deleted strategies + llm_buyer)
src/strategies/         idle, rpc_poll, transfer,   all six unused
                        payment, helius_monitor, weather
```

**Tests (4 files) — they test the deleted code:**

```
src/manager.test.ts
src/message_bus.test.ts
src/shared_state.test.ts
src/workflow.test.ts
```

### REFACTOR (3 edits)

1. `coral-agents/buyer-agent/src/llm_buyer.ts` — decouple from the framework.
2. `packages/agent-runtime/src/index.ts` — slim to the two kept modules.
3. `packages/agent-runtime/package.json` — fix the now-false description.

### ADD (fix the test inversion)

After deletion the runtime would have **zero** tests, leaving its most important file
(`coral_mcp.ts`, 293 lines) untested. Add `src/coral_mcp.test.ts` for `parseMention` — the trickiest,
most fragile logic in the kept code.

---

## Step 1 — delete the framework

```sh
cd packages/agent-runtime/src
rm agent.ts manager.ts message_bus.ts shared_state.ts workflow.ts \
   sync.ts role.ts log.ts types.ts strategy.ts
rm -r strategies
rm manager.test.ts message_bus.test.ts shared_state.test.ts workflow.test.ts
```

After this, `src/` contains exactly: `coral_mcp.ts`, `coral_mcp_server.ts`, `index.ts`
(+ the new `coral_mcp.test.ts` from Step 5).

---

## Step 2 — rewrite `src/index.ts`

Replace the whole file with the kept surface only:

```ts
// @pay/agent-runtime — the CoralOS MCP client. The agent economy's entire runtime surface.

// CoralOS MCP client
export { CoralMcpAgent } from './coral_mcp.js'
export type { CoralMention, CoralMcpConfig } from './coral_mcp.js'

// Standalone CoralOS agent entrypoint (injected CORAL_CONNECTION_URL → your run loop)
export { startCoralAgent } from './coral_mcp_server.js'
export type { CoralAgentConfig, CoralAgentContext } from './coral_mcp_server.js'
```

---

## Step 3 — decouple `llm_buyer.ts` from the framework

`LLMBuyerStrategy` extends `BaseStrategy` and threads a `MutableAgentState` through purely to call
`recordAction(...)`. Nothing instantiates it, so replace that framework dependency with a tiny local
action-log function. **No behaviour changes; `parse402` and `purchase()` keep working.**

**3a. Replace the import (line 18):**

```ts
// REMOVE:
import { BaseStrategy, type MutableAgentState, untilAborted } from '@pay/agent-runtime'

// ADD (local action sink — was MutableAgentState.recordAction):
/** Sink for purchase-loop events. Defaults to console; pass your own to capture them. */
export type ActionLog = (type: string, details: string, txSignature?: string) => void
const logToConsole: ActionLog = (t, d, sig) =>
  console.error(`[llm-buyer] ${t}: ${d}${sig ? ` sig=${sig}` : ''}`)
```

**3b. Drop the base class and the framework-only `run()` method (lines 67–75):**

```ts
// BEFORE:
export class LLMBuyerStrategy extends BaseStrategy {
  readonly name = 'llm-buyer'
  constructor(private config: LLMBuyerConfig) { super() }

  async run(state: MutableAgentState, signal: AbortSignal): Promise<void> {
    const result = await this.purchase(state)
    state.recordAction('purchase-complete', result.slice(0, 200))
    await untilAborted(signal)
  }

// AFTER:
export class LLMBuyerStrategy {
  readonly name = 'llm-buyer'
  constructor(private config: LLMBuyerConfig) {}
```

**3c. Swap the `MutableAgentState` parameter for `ActionLog` in `purchase` and `runTool`:**

```ts
// purchase signature:
async purchase(log: ActionLog = logToConsole): Promise<string> {
  ...
  results.push(await this.runTool(tu, log, purchase))   // was (tu, state, purchase)
}

// runTool signature:
private async runTool(
  tu: Anthropic.ToolUseBlock,
  log: ActionLog,                                        // was state: MutableAgentState
  guard: PurchaseGuard,
): Promise<Anthropic.ToolResultBlockParam> {
```

**3d. Replace the three `state.recordAction(...)` calls:**

```ts
state.recordAction('payment-challenge', JSON.stringify(challenge))
  → log('payment-challenge', JSON.stringify(challenge))

state.recordAction('payment-sent', `${input.amountSol} SOL`, sig)
  → log('payment-sent', `${input.amountSol} SOL`, sig)
```

(The `purchase-complete` call lived in the deleted `run()` — gone with it.)

After 3a–3d, `llm_buyer.ts` imports nothing from `@pay/agent-runtime`. The buyer-agent still depends
on the runtime via `index.ts`'s `startCoralAgent`, so the `file:` dependency stays.

---

## Step 4 — fix the package description

`packages/agent-runtime/package.json`:

```json
"description": "CoralOS MCP client + agent entrypoint for the Solana agent economy",
```

(was *"TypeScript multi-agent runtime — mirrors agent-core concepts exactly"* — the mirror is gone).

---

## Step 5 — add the missing test (`src/coral_mcp.test.ts`)

First make `parseMention` testable — in `coral_mcp.ts`, change:

```ts
function parseMention(raw: string): CoralMention {
// to:
export function parseMention(raw: string): CoralMention {
```

Then add `packages/agent-runtime/src/coral_mcp.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseMention } from './coral_mcp.js'

describe('parseMention — CoralOS response shapes', () => {
  it('nested messages[] (current CoralOS format)', () => {
    const m = parseMention(JSON.stringify({
      threadId: 't1',
      messages: [{ senderName: 'buyer-agent', text: 'request risk-score' }],
    }))
    expect(m).toEqual({ threadId: 't1', sender: 'buyer-agent', text: 'request risk-score' })
  })

  it('single message object', () => {
    const m = parseMention(JSON.stringify({
      message: { threadId: 't2', sender: 'seller-agent', content: 'PAYMENT_REQUIRED' },
    }))
    expect(m.threadId).toBe('t2')
    expect(m.sender).toBe('seller-agent')
    expect(m.text).toBe('PAYMENT_REQUIRED')
  })

  it('flat text/content at top level', () => {
    const m = parseMention(JSON.stringify({ threadId: 't3', senderName: 'x', text: 'paid <sig>' }))
    expect(m.text).toBe('paid <sig>')
  })

  it('timeout response → empty text (caller treats as null)', () => {
    expect(parseMention(JSON.stringify({ status: 'Timeout reached' })).text).toBe('')
  })

  it('non-JSON raw → used as text verbatim', () => {
    expect(parseMention('plain string').text).toBe('plain string')
  })
})
```

Result: the runtime keeps a green test suite, and it now covers the code that actually runs in
production instead of the framework that didn't.

---

## Step 6 — update the docs that list the deleted modules

These describe the runtime as a multi-module framework and will be stale:

- **`CLAUDE.md`** → *Architecture › packages/agent-runtime*: remove the `manager.ts`,
  `strategy.ts`, `message_bus.ts`, `shared_state.ts`, `workflow.ts`, and `strategies/` bullets.
  Replace with: `coral_mcp.ts` (MCP client) and `coral_mcp_server.ts` (`startCoralAgent`). Drop the
  *"AgentManager is not thread-safe across workers"* constraint (no longer applicable).
- **`OVERVIEW.md`** → *Part 3a — the engine*: replace the `Agent`/`AgentManager`/`MessageBus`/
  `SharedState`/`WorkflowEngine`/*Ready-made Strategies* list with the two kept modules.
- **`packages/agent-runtime/README.md`** → rewrite to: "the CoralOS MCP client — `CoralMcpAgent`
  and `startCoralAgent`," with the seller loop as the example.

---

## Step 7 — verify

```sh
# 1. Runtime: builds, typechecks, tests (now the coral_mcp test)
cd packages/agent-runtime && npm run typecheck && npm test && npm run build

# 2. The agent that was refactored
cd ../../coral-agents/buyer-agent && npm run typecheck && npm test

# 3. The other consumers still compile against the slimmed dist
cd ../seller-agent && npm run typecheck && npm test
cd ../broker && npm run typecheck && npm test
cd ../echo-agent && npm run typecheck
```

Expected: all green. Runtime test count drops from 22 (framework) to 5 (parseMention). Agent test
counts are unchanged (seller 11, buyer 8, broker 5) — proof the deletion touched no live path.

> ⚠️ **Build order still holds:** `coral-agents` and `examples` consume the runtime's `dist/` via
> `file:` deps. Run the runtime `npm run build` (Step 7.1) **before** the consumer typechecks so they
> resolve the new, smaller surface.

---

## What "done" looks like

```
packages/agent-runtime/src/
  coral_mcp.ts          ← the MCP client          (kept)
  coral_mcp_server.ts   ← startCoralAgent          (kept)
  coral_mcp.test.ts     ← parseMention tests       (new)
  index.ts              ← 2 modules exported        (rewritten)
```

One runtime, one job: connect an agent to CoralOS. Everything the economy doesn't use is gone, and
the thing it depends on most is finally tested.
