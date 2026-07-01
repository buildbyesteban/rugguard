# RugGuard — short demo video script (~2 min)

Screen-record the dashboard at `http://localhost:5180` (clean URL, no `?session=`).
~90 seconds of talking. Paste two tokens; trim the ~60–90s waits in editing.

**Tokens:**
1. 🟢 WIF (dogwifhat) — `EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm`
2. 🔴 WHITEBULL (pump.fun) — `JBRhpdRYVvXgzMT9UDmTQ4ojpG82ETp86PLJF2yNpump`  *(re-check it's still red before recording)*

---

## The script (just read it)

> Hi, I'm Hassan, and this is RugGuard — my submission for the Solana and CoralOS track. It's a marketplace of four AI agents that pay each other, on Solana, to check whether a token is safe before trading it — no humans involved.
>
> The problem: AI agents now move real money on-chain, and a bad token — a rug — can wipe them out. They need that safety check instantly, and they need to trust it.
>
> Here's how it works. A **buyer** agent asks "is this token safe?". Two **seller** agents compete to answer. And an **independent verifier** re-reads the blockchain to make sure the answer is true — the money only moves if it checks out. Let me show you, live.
>
> *(paste WIF)* First, a real coin — dogwifhat. The sellers bid, the cheaper one wins, it's paid into escrow, and the verdict comes back **LOOKS OK** — ownership's spread out, nothing scary. The verifier confirms it, and the escrow pays out.
>
> *(paste WHITEBULL)* Now a random pump.fun coin. Same flow — but this time, **HIGH RISK**. One wallet holds sixty percent of the supply. That's someone who can dump and crash it instantly — the classic rug. The agent catches it and walks away.
>
> *(click "release" and "verifier fee")* And it's all real — here are the actual on-chain transactions: the payment to the seller, and the fee to the verifier. Two settlements, every round, no human in the loop.
>
> That's RugGuard — a real service agents need, built on CoralOS and Solana, fully open-source. Thanks for watching.

---

### Make sure these show on screen
- WIF: risk gauge + ✓ flags + **VERIFIED ✓** badge
- WHITEBULL: the **top-holder %** and the red **HIGH RISK**
- Click **release ↗** and **verifier fee ↗** so the Solana explorer opens
- End on the RugGuard header + repo: github.com/syedhassan125/rugguard

### If a judge asks
- **"Is the money real?"** → "Devnet test SOL — real on-chain transactions, safe play money, as the hackathon expects. Same code runs on mainnet with real funds."
