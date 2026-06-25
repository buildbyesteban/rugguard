# Agent Economy — dev tasks.  Run `just dev` for one-shot setup → build → run.
#
# Needs: Docker Desktop running, Node 20+, and `just` (https://github.com/casey/just):
#   cargo install just   |   brew install just   |   winget install Casey.Just
# No `just`? Each recipe below is just shell — run the commands by hand.

set shell := ["bash", "-c"]

# default: show the recipes
default:
    @just --list

# ── one-shot: wallets + airdrop + build + run ───────────────────────────────
dev: setup build up
    @echo ""
    @echo "✅ Agent economy is up (coral + bridge)."
    @echo "   Open  http://localhost:3010   →  click 'Run the agent↔agent demo'"
    @echo "   (give the agents ~20s to spawn on the first run)"
    @echo ""
    @echo "   If the airdrop was rate-limited, fund the two .env wallets at https://faucet.solana.com"
    @echo "   Logs:  just logs    ·    Stop:  just down"

# generate devnet wallets (if needed) + airdrop them
setup:
    cd scripts && npm install --silent --no-audit --no-fund
    node scripts/setup.js
    node scripts/airdrop.js

# build the agent images coral-server launches
build:
    bash build-agents.sh

# start coral-server + the bridge (serves the demo UI on :3010)
up:
    MSYS_NO_PATHCONV=1 docker compose up -d coral bridge

# run the autonomous loop from the CLI (alternative to the UI button)
auto:
    cd examples/agent-economy/autonomous && npm install --silent --no-audit --no-fund && npm start

# tail coral-server logs
logs:
    docker compose logs -f coral

# stop everything
down:
    docker compose down
