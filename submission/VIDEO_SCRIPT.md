# RugGuard — 3-minute demo video script

**Format:** Problem → Solution → Demo → Team. Lead with the settlement; don't pitch the plumbing.
**Total ≈ 3:00.** Screen-recording of the dashboard + a couple of slides. One voice.

---

## 0:00–0:30 — Problem (the moment)
> *(On screen: a trading agent about to buy a token it's never seen.)*

"Autonomous agents now hold and move money on Solana — trading bots, treasury agents, DeFi routers. But before any of them buys a token, there's a question a human would ask and an agent usually can't: **is this a rug?** Can the team mint infinite supply? Can they freeze my wallet so I can never sell?

A human checks a block explorer. An agent needs that answer **at machine speed, on-chain, and trustlessly** — because it's about to spend real money with no one watching."

## 0:30–1:00 — Solution
> *(On screen: the RugGuard graph — buyer, two sellers, verifier.)*

"RugGuard is an open market for exactly that check. A buyer agent broadcasts 'is this mint safe?'. Two seller agents — a fast scanner and a deep auditor — **compete** to deliver the verdict, reading the token's on-chain facts. The winner is paid through a Solana escrow.

But here's the part that makes it trustless: an **independent verifier agent** re-reads the same token from the chain and has to confirm the report **before the escrow releases**. The seller can't be paid for a lie — and the verifier gets paid for keeping them honest. A pair of agents becomes a graph."

## 1:00–2:20 — Demo (the proof)
> *(Screen-record the live dashboard, one round, narrate as it happens.)*

"This is running on devnet right now. One command.

- The buyer **WANTs** a rug-check on a real mainnet token.
- Both sellers **bid** — the scanner undercuts, the auditor charges a premium. The buyer picks **best value** and explains why.
- It **deposits** into escrow — here's the transaction on the explorer.
- The seller **delivers** the report: the risk score, the verdict, and the raw on-chain facts.
- Now watch the verifier: it **re-reads the chain itself** and posts **VERIFIED** — the facts match.
- Only now does the buyer **release** the escrow to the seller — *(click the explorer link)* — and **pay the verifier its fee** — *(second explorer link)*. Two real settlements, no human in the loop.

And the dispute case: *(if showing)* if a report fails verification, the buyer **withholds release** and the deposit refunds after the deadline. The buyer never pays for a bad answer."

## 2:20–2:50 — Why it matters
> *(Back to a slide.)*

"One rug is a total loss. This check costs a fraction of a cent. That's insurance priced for machines — a service worth buying millions of times a day, settling trustlessly each time. The plumbing — CoralOS coordination, Solana Pay, the escrow contract — was already proven. What we built on top is **a service agents actually want, and an economy that stays honest under dispute.**"

## 2:50–3:00 — Team
> *(Closing slide: name + repo + the two explorer links.)*

"Built on the solana_coralOS kit for the Imperial AI Agent Hackathon. Everything's open-source, runs on devnet with one command, and every settlement you saw is on-chain. Thanks for watching."

---

### Shot list / what to capture
1. Dashboard mid-round: bids visible, one marked winner. (0:30, 1:10)
2. The RugCheckPanel: risk gauge + verdict + signals. (1:30)
3. The VerifierBadge flipping to **VERIFIED ✓**. (1:50)
4. Click both explorer links (release tx + verifier-fee tx) — show them resolve on explorer.solana.com. (2:00)
5. Slides 1, 4, 5 of the deck for the talking-head sections.
