// Lazy CoralClient singleton — reuses one instance per page load.
// Uses require() to avoid SSR issues with the SDK's browser-only fetch usage.

// eslint-disable-next-line @typescript-eslint/no-require-imports
let _client: import('../../../typescript_sdk/sdk/src/client').CoralClient | null = null

export function getClient() {
  if (!_client) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CoralClient } = require('../../../typescript_sdk/sdk/src/client') as typeof import('../../../typescript_sdk/sdk/src/client')
    const baseUrl = process.env.NEXT_PUBLIC_CORAL_SERVER ?? 'http://localhost:8080'
    _client = new CoralClient(baseUrl)
  }
  return _client!
}
