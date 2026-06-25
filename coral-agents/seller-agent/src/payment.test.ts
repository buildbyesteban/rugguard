import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock only the RPC Connection; keep PublicKey / LAMPORTS_PER_SOL real.
const getTransaction = vi.fn()
vi.mock('@solana/web3.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solana/web3.js')>()
  return { ...actual, Connection: vi.fn(() => ({ getTransaction })) }
})

import { verifyPayment } from './payment.js'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

const SELLER = '7jwB6M2DtuDuXJvFT9RiEwDQUX6Q3DhwtDwg3v8DpjZw'
const OTHER = '47DpazckSKKXtyU4hnoJizJjMXmfodgm9pNBXTBN4L4Y'
const PRICE = 0.0001

beforeEach(() => {
  process.env.SELLER_WALLET = SELLER
  process.env.PRICE_SOL = String(PRICE)
  getTransaction.mockReset()
})

/** Craft a confirmed tx where `recipient` received `receivedSol`. */
function txWith(receivedSol: number, recipient = SELLER) {
  const keys = [new PublicKey(recipient)]
  return {
    transaction: { message: { getAccountKeys: () => ({ staticAccountKeys: keys }) } },
    meta: { preBalances: [0], postBalances: [Math.round(receivedSol * LAMPORTS_PER_SOL)] },
  }
}

describe('verifyPayment', () => {
  it('accepts a tx that paid the full price to the seller', async () => {
    getTransaction.mockResolvedValue(txWith(PRICE))
    expect(await verifyPayment('sig', 'memo')).toBe(true)
  })

  it('accepts within the 1% tolerance', async () => {
    getTransaction.mockResolvedValue(txWith(PRICE * 0.995))
    expect(await verifyPayment('sig', 'memo')).toBe(true)
  })

  it('rejects an underpayment', async () => {
    getTransaction.mockResolvedValue(txWith(PRICE * 0.5))
    expect(await verifyPayment('sig', 'memo')).toBe(false)
  })

  it('rejects payment to the wrong recipient', async () => {
    getTransaction.mockResolvedValue(txWith(PRICE, OTHER))
    expect(await verifyPayment('sig', 'memo')).toBe(false)
  })

  it('rejects a missing / unconfirmed transaction', async () => {
    getTransaction.mockResolvedValue(null)
    expect(await verifyPayment('sig', 'memo')).toBe(false)
  })

  it('rejects on an RPC error (fails closed)', async () => {
    getTransaction.mockRejectedValue(new Error('rpc down'))
    expect(await verifyPayment('sig', 'memo')).toBe(false)
  })
})
