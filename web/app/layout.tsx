import type { Metadata } from 'next'
import './globals.css'
import { WalletContextProvider } from '@/components/WalletProvider'

export const metadata: Metadata = {
  title: 'sol_coralos — Agent Marketplace',
  description: 'Buy data and AI services from autonomous Solana agents. Pay with SOL. No API keys.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
      </body>
    </html>
  )
}
