# RugGuard — 3-minute demo video script

A natural, spoken script — read it start to finish like you're talking to a friend.
Screen-record the dashboard at `http://localhost:5180` (clean URL, no `?session=`).
Roughly 3 minutes. Paste the three tokens in order; talk over the ~60–90s each round takes.

**Tokens to paste, in order** (a safe one, then the two ways a token rugs):
1. 🟢 WIF — `EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm`  (safe)
2. 🔴 MBAPEPE — `8FkKnfk7H2Ebgphq4dY3TS1RJ4Bw2kW3Y6Mwa7M3pump`  (rug by concentration — one whale)
3. 🔴 USDC — `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`  (rug by control — mint/freeze)

---

## The script (just read it)

> Hey, I'm Hassan, and this is my submission for the Solana and CoralOS track at the UK AI Agent Hackathon. My project is called RugGuard.
>
> So here's the idea. AI agents are starting to hold and move real money on Solana — trading bots, wallets, all of it. But before any agent buys a token, there's one question that decides whether it makes money or loses everything: is this token a rug?
>
> A rug is when the people behind a coin can quietly print unlimited supply, or freeze your wallet so you can't sell, or dump a giant hidden bag on you. A human would catch that by checking the token first. But an agent moving at machine speed can't stop and ask a person — it needs that safety check instantly, and it needs to trust the answer without trusting whoever's selling it.
>
> That's what RugGuard is. It's a little marketplace where agents buy and sell exactly one thing: a rug-check on a token. Let me just show you it running — it's live on Solana right now.
>
> *(Paste WIF, click "Rug-check this token.")*
>
> So I'll paste in a real token — this is dogwifhat. The moment I hit go, a buyer agent asks the market "is this safe?", and two seller agents compete to answer — a fast one and a premium one. The cheaper one wins the bid, and the buyer locks its payment into a Solana escrow. The seller reads the token's actual on-chain data and sends back a verdict… and there it is — LOOKS OK. Mint and freeze are renounced, the ownership is spread out, nothing scary.
>
> But here's the part I'm most proud of. The buyer doesn't just take the seller's word for it. There's a third agent — an independent verifier — that re-reads the blockchain itself to confirm the report is true. Only when it says "verified" does the escrow actually pay out. So a seller can never get paid for lying, and the verifier earns a small fee for keeping everyone honest. A pair of agents becomes a whole self-policing economy.
>
> *(Paste MBAPEPE.)*
>
> Now let's try a random memecoin off pump.fun. Same flow… but watch the verdict this time — HIGH RISK. One single wallet holds more than half the entire supply. That's someone who can dump and crash the price whenever they want — and that's how most memecoins actually rug. The agent catches it before going anywhere near it.
>
> *(Paste USDC.)*
>
> And here's a completely different way a token can be dangerous — one where the creators still hold the keys, so they can mint more or freeze your wallet at any time. Also HIGH RISK, the verifier agrees, and the buyer walks away. Two different rug traps — both caught.
>
> *(Click the "release" and "verifier fee" links to open the explorer.)*
>
> And none of this is faked — every deal settles on-chain. Here's the actual payment to the seller on the Solana explorer, and here's the fee paid to the verifier. Two real settlements, every round, with no human anywhere in the loop.
>
> So that's RugGuard — a service agents genuinely need, an economy that stays honest even under a dispute, built on CoralOS and Solana. It's fully open-source and a judge can run the whole thing with one command. I'm Hassan — thanks for watching.

---

### While recording — make sure these show up
- Round 1 (WIF): the risk gauge, the ✓ mint/freeze flags, and the **VERIFIED ✓** badge
- Round 2 (MBAPEPE): the **top-holder %** and the red **HIGH RISK**
- Round 3 (USDC): the red **HIGH RISK**
- Click **release ↗** and **verifier fee ↗** so the Solana explorer opens on a real transaction
- End on the RugGuard header + the repo URL: github.com/syedhassan125/rugguard

### If a judge pushes back
- **"USDC isn't a rug."** → "Right — RugGuard flags whoever still holds mint and freeze power. For a regulated stablecoin that's by design; for an anonymous memecoin it's the number-one rug signal. Same check — context decides."
- **"Is the money real?"** → "It settles in devnet test SOL — real on-chain transactions, safe play money, exactly what the hackathon asks for. Point it at mainnet and it's real funds, same code."

### Delivery tips
- Optional but nice: show your face for the first line ("Hey, I'm Hassan…"), then cut to the screen recording.
- Don't rush the WIF → MBAPEPE → USDC moment — safe, then the two ways a token rugs, is the whole story.
- If a round is slow, keep talking; trim the dead air afterwards.
