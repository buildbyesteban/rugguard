// @pay/agent-runtime — the CoralOS MCP client. The agent economy's entire runtime surface.

// CoralOS MCP client
export { CoralMcpAgent } from './coral_mcp.js'
export type { CoralMention, CoralMcpConfig } from './coral_mcp.js'

// Standalone CoralOS agent entrypoint (injected CORAL_CONNECTION_URL → your run loop)
export { startCoralAgent } from './coral_mcp_server.js'
export type { CoralAgentConfig, CoralAgentContext } from './coral_mcp_server.js'

// Devnet safety — guard agent payment code against a stray mainnet RPC
export { assertDevnet, solanaConnection, DEVNET_RPC } from './solana.js'
