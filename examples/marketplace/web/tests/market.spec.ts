import { test, expect } from '@playwright/test'
import { fixtureRounds } from './fixtures'

// Mock the feed server so the e2e is deterministic and needs no devnet / LLM key.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/feed**', (route) =>
    route.fulfill({ json: { session: 'demo', rounds: fixtureRounds, updatedAt: new Date().toISOString() } }),
  )
})

test('renders the live auction from the feed', async ({ page }) => {
  await page.goto('/?session=demo')

  // newest round first → round #2 (bidding) above round #1 (settled)
  const rounds = page.getByTestId('round')
  await expect(rounds).toHaveCount(2)

  const settled = page.locator('[data-testid="round"][data-round="1"]')
  await expect(settled.getByTestId('status')).toHaveText('settled')
  await expect(settled.getByTestId('bid')).toHaveCount(2)
  await expect(settled.getByTestId('declined')).toHaveText(/seller-lazy/)
  await expect(settled.getByTestId('reason')).toContainText('verified data worth the premium')

  // the winning bid is highlighted and the release links to the devnet explorer
  const winner = settled.locator('[data-testid="bid"][data-seller="seller-premium"]')
  await expect(winner).toHaveClass(/bid-won/)
  const release = settled.getByTestId('settle').last()
  await expect(release).toHaveAttribute('href', /explorer\.solana\.com\/tx\/3PMa.*cluster=devnet/)
})

test('shows the connection indicator', async ({ page }) => {
  await page.goto('/?session=demo')
  await expect(page.getByTestId('conn')).toBeVisible()
})
