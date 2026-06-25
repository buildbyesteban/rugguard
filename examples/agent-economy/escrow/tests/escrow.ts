/**
 * Escrow tests (sketch). Run with `anchor test` against a local validator, or port to LiteSVM/Mollusk
 * for fast in-process unit tests (see the solana-dev skill's testing reference).
 */
import * as anchor from '@coral-xyz/anchor'
import { Program, BN } from '@coral-xyz/anchor'
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { assert } from 'chai'
import { escrowPda } from '../client/escrow'

describe('escrow', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.Escrow as Program<any>

  const buyer = (provider.wallet as anchor.Wallet).payer
  const seller = Keypair.generate()
  const AMOUNT = 0.01

  it('deposit → release pays the seller', async () => {
    const reference = Keypair.generate().publicKey
    const before = await provider.connection.getBalance(seller.publicKey)

    await program.methods
      .initialize(new BN(AMOUNT * LAMPORTS_PER_SOL), reference, new BN(Math.floor(Date.now() / 1000) + 3600))
      .accounts({ buyer: buyer.publicKey, seller: seller.publicKey, escrow: escrowPda(buyer.publicKey, reference) })
      .rpc()

    await program.methods
      .release()
      .accounts({ buyer: buyer.publicKey, seller: seller.publicKey, escrow: escrowPda(buyer.publicKey, reference) })
      .rpc()

    const after = await provider.connection.getBalance(seller.publicKey)
    assert.equal(after - before, AMOUNT * LAMPORTS_PER_SOL, 'seller received the escrowed amount')
  })

  it('refund before the deadline fails', async () => {
    const reference = Keypair.generate().publicKey
    await program.methods
      .initialize(new BN(AMOUNT * LAMPORTS_PER_SOL), reference, new BN(Math.floor(Date.now() / 1000) + 3600))
      .accounts({ buyer: buyer.publicKey, seller: seller.publicKey, escrow: escrowPda(buyer.publicKey, reference) })
      .rpc()

    try {
      await program.methods
        .refund()
        .accounts({ buyer: buyer.publicKey, escrow: escrowPda(buyer.publicKey, reference) })
        .rpc()
      assert.fail('refund should be rejected before the deadline')
    } catch (e) {
      assert.include(String(e), 'BeforeDeadline')
    }
  })
})
