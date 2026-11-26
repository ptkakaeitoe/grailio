#!/usr/bin/env bash
# Verify every deployed Collect contract on Snowtrace (Routescan), reading the
# addresses from ../deployments/43114.json. Safe to re-run: verified contracts
# are skipped by the explorer. Constructor arguments are read from the
# deployment transactions (--guess-constructor-args), so it needs an RPC.
# Snowtrace only (--verifier etherscan): nothing is sent to other services.
#
#   cd contracts && AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc ./script/verify.sh
set -euo pipefail
cd "$(dirname "$0")/.."

: "${AVALANCHE_RPC_URL:?set AVALANCHE_RPC_URL (any Avalanche C-Chain RPC)}"
# Routescan doesn't need a real key; any value works.
export SNOWTRACE_API_KEY="${SNOWTRACE_API_KEY:-verifyContract}"

deployment="../deployments/43114.json"
address_of() {
  python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2], ""))' "$deployment" "$1"
}

# JSON key -> source:contract
pairs=(
  "collectPacks src/CollectPacks.sol:CollectPacks"
  "collectMarket src/CollectMarket.sol:CollectMarket"
  "collectPoints src/CollectPoints.sol:CollectPoints"
  "collectDao src/CollectDAO.sol:CollectDAO"
  "collectChat src/CollectChat.sol:CollectChat"
  "collectNames src/CollectNames.sol:CollectNames"
  "collectProfiles src/CollectProfiles.sol:CollectProfiles"
  "collectStaking src/CollectStaking.sol:CollectStaking"
)

for pair in "${pairs[@]}"; do
  key="${pair%% *}"
  contract="${pair#* }"
  address="$(address_of "$key")"
  if [[ -z "$address" || "$address" == "0x0000000000000000000000000000000000000000" ]]; then
    echo "skip $key: not deployed yet"
    continue
  fi
  echo "verify $key at $address"
  forge verify-contract "$address" "$contract" \
    --chain 43114 \
    --verifier etherscan \
    --verifier-url "https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan" \
    --rpc-url "$AVALANCHE_RPC_URL" \
    --guess-constructor-args \
    --watch
done
