# Marketplace feed server

A ~60-line Express proxy — the only backend the visualizer needs. It reads a CoralOS session's
transcript (extended state, behind the dev token), folds it into typed market `Round`s, and serves
CORS-enabled JSON for the React app to poll.

```
GET /api/health              → { ok: true }
GET /api/feed?session=<sid>  → { session, rounds, updatedAt }
```

`foldRounds` (the fold logic) **reuses `@pay/agent-runtime`'s parsers**, so the market wire protocol
has one source of truth. It's pure and has its own unit tests.

```sh
npm install
npm test            # foldRounds unit tests (full round, declined seller, refund, interleaved)
npm start           # serves on :4000  (env: CORAL_SERVER_URL, CORAL_TOKEN, SESSION, MARKET_SELLERS, PORT)
```

The browser never touches coral or Solana — keeping the token server-side and avoiding CORS. See
[`docs/MARKETPLACE_FRONTEND.md`](../../../docs/MARKETPLACE_FRONTEND.md).
