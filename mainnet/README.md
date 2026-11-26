# Collect

Open $1 packs, collect cards that hold real tokens, trade them, vote and chat, on Avalanche C-Chain (mainnet, chain 43114). **Public beta.**

The app (Next.js) is in the repo root; the Solidity contracts are in [`contracts/`](contracts/README.md). Rebuilt from the `stonks` Fuji prototype.

## Status

- **Tokens first, stocks later.** Tokenized stocks aren't on Avalanche yet, so the beta cards hold BTC.b, WETH.e, WAVAX, LINK.e and JOE. The stock framing in the copy stays for launch.
- **Demo mode uses stocks.** In demo, the same relics track AAPL, MSFT, NVDA, TSLA and AMZN at live Yahoo Finance prices (`DEMO_STOCK_CARDS` in `lib/cards.ts`, `/api/prices?set=stocks`). `useCards()` and `useStockPrices()` pick the set from the current mode; live-only views pin token prices.
- **Contracts are written and tested but not deployed.** Until `deployments/43114.json` has addresses, on-chain pages show demo mode or an "at launch" state. Swaps on `/trade` are already real (they go through KyberSwap, not our contracts).
- **No Collect token.** Prices and payments are in USDC (and AVAX on the marketplace). DAO votes use non-transferable points.

## Pages

| Route | What |
| --- | --- |
| `/` | Live prices, packs, get started |
| `/packs` | Buy and open $1 packs (three designs, three risk levels) |
| `/trade` | Real swaps via KyberSwap at the best DEX route |
| `/marketplace` | Buy and sell cards, priced in AVAX or USDC |
| `/collection` | Your cards (stake, redeem, view) and unopened packs to open |
| `/gift` | Claim a gift code; see and cancel gifts you sent (buy them on `/packs` with "As a gift") |
| `/profile`, `/@handle` | Username, picture, bio, socials, ID card and holdings |
| `/dao` | Proposals and votes with collector points (1 per pack bought; demo too) |
| `/community` | Open lounge plus an encrypted room per token for its card holders |
| `/treasury` | Owner: pack pool, what's owed, withdraw, pause |
| `/info` | Field guide and contract table |
| `/v2` | Minimal black-and-white test UI over the same code |

## How it works

### Packs

Every pack costs **$1 in USDC** and earns **1 DAO point**. Each card holds one random token, 1 in 5 each. All three designs average **$0.91 of tokens** per pack (a 9% house edge); only the spread differs.

| Pack (risk) | Common | Rare | Epic | Legendary |
| --- | --- | --- | --- | --- |
| Realistic (lowest) | 50% · $0.82 | 25% · $0.90 | 20% · $1.04 | 5% · $1.34 |
| Classic (medium) | 50% · $0.46 | 25% · $0.80 | 20% · $1.40 | 5% · $4.00 |
| Futuristic (high) | 60% · $0.20 | 25% · $0.60 | 12% · $2.80 | 3% · $10.13 |

**Where the $1 goes:** into the pack contract's USDC prize pool. When a pack opens, the contract swaps the card's value from USDC into its token on a DEX (guarded by Chainlink prices) and locks it in the card. On average $0.91 leaves as tokens in cards and about $0.09 stays as profit. The owner can only withdraw USDC above what unopened packs could still pay out. Odds live in `PACK_TIERS` (`lib/contracts.ts`) and `contracts/script/MainnetConfig.sol`.

### Prices (`lib/quotes.ts`)

- **Live price:** read on chain from pinned DEX pools (Uniswap v3 for WAVAX, BTC.b, WETH.e, LINK.e; LFJ v1 for JOE), cached for 30 seconds.
- **24h change and charts:** GeckoTerminal for the same pools, cached for 60 seconds. Its free tier allows about 30 requests a minute.
- The LINK and JOE pools are thin; the pack contract prices fills with Chainlink, not these pools.

### Swaps (`/trade`)

KyberSwap routes each trade across Avalanche DEXes. `GET /api/swap/quote` returns the route; `POST /api/swap/build` returns calldata (beta cookie required, slippage capped at 5%). The user's wallet signs; the server never signs or sends. Every swap must target KyberSwap's router, checked on the server and in the browser. No platform fee is taken.

### Beta gate

Anyone can browse and use demo mode. **Connecting a wallet needs a beta code.** The code is checked on the server, which sets a signed httpOnly cookie for 90 days; wallets that connect without it are disconnected. This is a UI gate: contracts on a public chain can still be called directly.

## Setup

```bash
git clone --recurse-submodules <repo-url>   # or: git submodule update --init --recursive
cp .env.example .env.local                  # fill in the values below
npm install
npm run dev
```

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Sign-in (Privy: email, Google or a wallet; makes a wallet for people without one). Free at dashboard.privy.io; enable Avalanche and add your domain. Without it, local dev uses a browser wallet |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional: mobile wallet apps via WalletConnect in the sign-in list (free at cloud.reown.com) |
| `BETA_ACCESS_CODES`, `BETA_COOKIE_SECRET` | The beta gate |
| `RELAYER_KEY` | Free chat posting (a dedicated wallet with a little AVAX) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared chat-relay limits (or Vercel KV's `KV_REST_API_URL`/`TOKEN`). Required in production: without it the relay refuses to post |
| `NEXT_PUBLIC_AVALANCHE_RPC_URL` | Optional: your own RPC instead of the public one |

Network settings live in `lib/chain.ts`. Tests: `npm run lint`, `node --test tests/*.mjs`, and `cd contracts && forge test`.

**Deploying the contracts** (spends real AVAX): see [contracts/README.md](contracts/README.md). The deploy script writes every address into `deployments/43114.json`; rebuild the app afterwards.

## Stack

Next.js 16 (App Router), React 19, wagmi 2, viem 2, Privy, Tailwind CSS 4, Foundry, OpenZeppelin 5. This Next version has breaking changes: read `AGENTS.md` first.
