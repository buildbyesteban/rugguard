'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'

// Wallet button must be client-only (uses browser APIs)
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)

export function Header() {
  return (
    <header className="border-b border-[#1e1e2e] bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-brand font-bold text-lg">sol_coralos</span>
          <span className="badge-gray">devnet</span>
        </Link>
        <WalletMultiButton
          style={{
            background: '#9945FF',
            borderRadius: '8px',
            fontSize: '14px',
            height: '36px',
            padding: '0 16px',
          }}
        />
      </div>
    </header>
  )
}
