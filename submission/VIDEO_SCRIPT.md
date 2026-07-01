# RugGuard — 3-minute demo video script (record-ready)

**Structure:** Personal intro → Problem → Solution → Live Demo → Proof → Close.
**Lead with the settlement. Don't pitch the plumbing.**
**Total ≈ 3:00.** Screen-record the dashboard (http://localhost:5180). One voice, calm and clear.

**Before you hit record:**
- Dashboard open at a **clean** URL: `http://localhost:5180` (no `?session=` on the end).
- Have the three addresses below copied somewhere easy to paste.
- Each round takes ~60–90s — you'll paste, talk over the wait, then react to the result. (You can lightly trim the dead time in editing.)

**Demo tokens (paste in this order):**
1. 🟢 WIF — `EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm`
2. 🟡 MBAPEPE — `8FkKnfk7H2Ebgphq4dY3TS1RJ4Bw2kW3Y6Mwa7M3pump`
3. 🔴 USDC — `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

---

## 0:00 – 0:20 — Intro  *(you on camera, or voice over the dashboard)*

> "Hey, I'm Hassan — and this is my submission for the Solana and CoralOS track at the UK AI Agent Hackathon. My project is called **RugGuard**. It's an open marketplace where AI agents pay each other, on-chain, to check whether a token is safe *before* they trade it — no humans in the loop. Let me show you the problem it solves, then run it live."

## 0:20 – 0:45 — Problem

> "Right now, AI agents on Solana are starting to hold and move real money. But before any of them buys a token, there's one question that decides everything: is this a rug? A rug pull is when a token's creators can secretly mint infinite supply, freeze your wallet, or dump a hidden bag — and you lose everything. A human would check a block explorer first. An autonomous agent trading at machine speed can't stop and ask a person — it needs that answer instantly, and it needs to trust it without trusting the seller."

## 0:45 – 1:10 — Solution  *(gesture at the explainer panel)*

> "Here's how RugGuard solves it. A buyer agent asks 'is this token safe?'. Two seller agents — a fast scanner and a premium auditor — compete to deliver the verdict from the token's real on-chain data. The buyer picks the best value and locks payment in a Solana escrow.
>
> And the key move is this: an **independent verifier agent re-reads the blockchain itself** and has to confirm the report before the escrow pays out. So a seller can never get paid for a lie — and the verifier earns a fee for keeping the market honest. It's a self-policing economy of agents."

## 1:10 – 2:30 — Live demo  *(the core — narrate as it happens)*

**🟢 Round 1 — a safe token.** *(Paste WIF, click "Rug-check this token.")*
> "Let's screen a real token — dogwifhat. Watch: both sellers bid, the cheaper scanner wins, payment goes into escrow… the report comes back **LOOKS OK** — mint and freeze authority renounced, ownership nicely spread across holders. The verifier re-checks the chain, confirms it, and the escrow releases. Green light."

**🟡 Round 2 — a risky one.** *(Paste MBAPEPE.)*
> "Now a random pump.fun coin. Same process — but look at the verdict: **CAUTION**. One single wallet holds over half the supply. That's a wallet that can crash the price instantly. The agent flags it before touching it."

**🔴 Round 3 — the catch.** *(Paste USDC.)*
> "And here's a token where the creators still hold the keys — they can mint more or freeze your wallet at any time. RugGuard returns **HIGH RISK**, the verifier agrees, and the buyer walks away. That's the system doing its job."

## 2:30 – 2:50 — Proof  *(click a settlement link)*

> "And none of this is a mock-up. Every deal settles on-chain — here's the actual escrow release on the Solana explorer, and here's the fee paid to the verifier. Real transactions, two settlements per deal, zero humans in the loop."

## 2:50 – 3:00 — Close  *(RugGuard title / repo on screen)*

> "So that's RugGuard — a service agents actually want, and an economy that stays honest under dispute, built on CoralOS and Solana. It's fully open-source and runs on devnet with one command. I'm Hassan — thanks for watching."

---

### On-screen checklist while recording
- [ ] Round 1 shows the **risk gauge**, ✓ mint/freeze flags, and **VERIFIED ✓** badge
- [ ] Round 2 clearly shows the **top-holder %** and the amber CAUTION
- [ ] Round 3 shows the red **HIGH RISK**
- [ ] Click **release ↗** and **verifier fee ↗** so the explorer transactions appear
- [ ] End on the RugGuard header + repo URL: github.com/syedhassan125/rugguard

### If asked in Q&A / judging
- **"USDC isn't a rug!"** → "Correct — RugGuard flags *who still holds mint/freeze power*. For a regulated stablecoin that's by design; for an anonymous memecoin it's the #1 rug signal. Same check, context decides."
- **"Is the money real?"** → "Settlement is devnet test SOL — real on-chain transactions, safe play money, exactly as the hackathon expects. Flip to mainnet and it's real funds, same code."
