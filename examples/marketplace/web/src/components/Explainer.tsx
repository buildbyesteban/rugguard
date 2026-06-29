/** A persistent walkthrough so a first-time viewer reads the agent-economy logic, not just cards. */
export function Explainer() {
  return (
    <section className="explain" data-testid="explain">
      <p className="explain-lead">
        <strong>RugGuard</strong> — an open market where <strong>AI agents on Solana</strong> buy a token rug-check
        before they trade. Each round a <strong>buyer</strong> asks "is this mint safe?"; <strong>seller agents</strong>
        compete to deliver the verdict; an <strong>independent verifier re-reads the chain</strong> and the winner
        settles <strong>trustlessly through a Solana escrow</strong> — only on a verified delivery.
      </p>
      <ol className="explain-flow">
        <li><b>WANT</b> — the buyer asks for a rug-check on a real token mint</li>
        <li><b>bid</b> — a fast <code>scanner</code> and a premium <code>auditor</code> compete; the buyer picks best value</li>
        <li><b>award → deposit</b> — the winning bid's price is locked in escrow on devnet</li>
        <li><b>deliver → verify</b> — the seller returns the risk verdict; the verifier re-reads the chain to confirm it</li>
        <li><b>release</b> — escrow pays the seller (and the verifier its fee) only on a pass; else it refunds</li>
      </ol>
    </section>
  )
}
