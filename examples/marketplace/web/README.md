# Marketplace visualizer

A read-only React app that renders the live auction — each round's `WANT`, the competing LLM bids
(winner highlighted, self-selected sellers shown as declined), the buyer's reasoning, and the on-chain
escrow settlement with clickable devnet Explorer links. It watches agents transact; there's no human
buyer and **no wallet** — fully on-thesis.

```
 web/ (React, this app) ──poll──▶ feed/ (Express) ──read──▶ coral session transcript
```

## Run

```sh
just market                       # launch a market session — note the printed session id
just feed                         # in another shell: the feed server on :4000 (proxies coral)
just dashboard                    # the UI on :5173
# open http://localhost:5173/?session=<the market session id>   (or paste it in the input)
```

## How it works

The browser never touches coral or Solana. The **feed server** reads the session's extended state,
folds the transcript into typed `Round`s with `foldRounds` — which **reuses `@pay/agent-runtime`'s own
parsers**, so the wire protocol has one source of truth — and serves CORS-enabled JSON the app polls.

## Test (no devnet, no LLM key)

```sh
cd examples/marketplace/web
npm test                          # Vitest + Testing Library — RoundCard renders bids/winner/links
npm run e2e                       # Playwright in a real browser vs a MOCKED feed (fixtures)
```

Both run fully offline against fixtures — deterministic and CI-friendly. The feed reducer has its own
unit tests in `../feed` (`npm test` there).

## Fork points

| Want… | Edit |
|-------|------|
| a new bid field (eta, reputation) | `src/components/BidRow.tsx` + the `Round` type + `../feed/src/foldRounds.ts` |
| a different look | `src/components/RoundCard.tsx` + `src/styles.css` |
| live push instead of polling | swap `useFeed`'s `setInterval` for an SSE endpoint on the feed server |
| let a human fund/settle (advanced) | add wallet-standard via framework-kit — see the `solana-dev` skill |

See [`docs/MARKETPLACE_FRONTEND.md`](../../../docs/MARKETPLACE_FRONTEND.md) for the full design.
