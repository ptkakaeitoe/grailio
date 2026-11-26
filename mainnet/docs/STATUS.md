# Collect — project status

_As of 2026-11-23. Written for an agent or developer picking up the work._

## 1. What Collect is

Collect is a beta app on **Avalanche C-Chain mainnet (chain 43114)**. Users buy **$1 USDC mystery packs**. Opening a pack mints a **card NFT** that holds a real token (BTC.b, WETH.e, WAVAX, LINK.e or JOE), bought on a DEX at the moment of opening. Cards can be kept, **staked** for a share of revenue, **sold** on the built-in market, or **redeemed** (burned for the tokens inside). The app also has collector points, a signal DAO, holder chat rooms, profiles with `/@handle` links, gift codes, and an any-token-to-any-token swap.

A **demo mode** runs the whole app on simulated funds, saved in the browser's localStorage.

- Live site: https://www.graily.xyz (graily.xyz redirects there; also https://collectx420.vercel.app). Vercel project `collectx420`, deployed by pushing to `main`. Domain at Namecheap, added to Privy and Reown on 2026-11-24.
- Repository: GitHub `ptkakaeitoe/collectX` (**private: keep it private**)
- Local path: `/Users/ptk/collect/collect` (app). Contracts are in `contracts/` (Foundry).

## 2. Repository state

- `main` is pushed and in sync with `origin/main`. Pushing deploys the site.
- **Contracts are live on mainnet** (deployed 2026-11-24, block 101184339, all verified on Snowtrace/Routescan). Addresses are in `deployments/43114.json`:
  - CollectPacks `0x92Dd466cd1bE08576937853Dc020291927D2221f`
  - CollectStaking `0xE1EaaCc44f809D7e07d1e9E0cC5d153e1b8f87d7`
  - CollectMarket `0xB2C321d1B01A4206436413085A2f15DA70456916`
  - CollectPoints `0x933986Fcf9F47F853f4196Dd3fb8a658E47235Da`, CollectDAO `0x5AbcA56748d6F0259d9E51F109cf3aab7bAD9428`
  - CollectChat `0x00681223d64940d92C96aD043cd777c0e82B1df1`, CollectNames `0x5490677B3A0F9bD411EBAC4d023d3fF7B8532951`, CollectProfiles `0xB4E3FDd414d059875b77b4b160a6f0ef9A194849`
- Owner of everything: the deployer `0x07a1944314f38ee5947301b0428958eaebde986a` (keystore `collect-deployer` on the user's Mac). Staking share 50%, DAO share 0.

## 3. Stack

- Next.js 16.3.6 (App Router; read `node_modules/next/dist/docs/` before writing Next code: it differs from older versions), React 19.2.8, Tailwind 4
- wagmi 2, viem 2.57.16, Privy (`@privy-io/react-auth` 3.51.3, `@privy-io/wagmi` 4.0.20)
- Contracts: Foundry, OpenZeppelin, Solidity ^0.8.28, `via_ir = true`, `optimizer_runs = 500`
- Swaps: KyberSwap aggregator (router `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5`), proxied through `/api/swap/quote` and `/api/swap/build`. **0.5% fee** (`lib/swap-fee.ts`): USDC swaps split 0.25% to CollectStaking and 0.25% to the treasury wallet (deployer for now); other swaps send 0.5% to the treasury in the token paid. `/api/swap/build` refuses routes without the fee.
- Chat relay limits: Upstash Redis REST (`lib/relay-limits.ts`); production refuses to relay without it
- Dependency rule: only pin releases at least about 2 weeks old. `package.json` has an npm override `{"permissionless":{"ox":"0.14.59"}}`.

## 4. App map

Routes in `app/`: home `/`, `/packs`, `/collection`, `/trade` (swap), `/marketplace`, `/community` (chat), `/dao`, `/profile`, `/u` (public `/@handle` profiles), `/treasury` (pool numbers and owner controls), `/info`, `/v2` (simplified development UI, see `AGENTS.md`).

API routes in `app/api/`: `beta` (beta-code gate), `prices`, `nft`, `nfts`, `history`, `chat/relay`, `swap/quote`, `swap/build`.

Key files:

- Wallet and login: `lib/wallet-auth.tsx`
  - `useWalletAuth()` returns `{ready, login, logout, fund, embedded, exportWallet}`.
  - Uses Privy when `NEXT_PUBLIC_PRIVY_APP_ID` is set (login with email, Google or an existing wallet); otherwise falls back to wagmi's injected connector.
  - `showWalletUIs: false` hides Privy's sign and approve pop-ups for embedded wallets. Collect shows its own confirm screens instead: `components/review-swap-dialog.tsx`, `components/pack-confirm-dialog.tsx`, `components/buy-confirm-dialog.tsx`.
- Beta gate: `components/beta-access.tsx`. **Off since 2026-11-24** (`BETA_GATE_ON = false` in `lib/beta-gate.ts`): anyone can connect; set it to `true` to require codes again. A gift link counts as an invite: `/api/beta/gift` checks the browser holds an open gift's code (it signs a message with the code's key; the code never leaves the browser) and issues the access cookie, so gift recipients skip the beta code.
- Contract addresses and ABIs: `lib/collect-packs.ts` and `lib/contracts.ts`, reading `deployments/43114.json`
  - Tiers: `PACK_TIERS`
  - Staking weights: `STAKE_WEIGHTS = [1,2,4,10]`
- Cards:
  - `lib/use-collect-market.ts`: a wallet's cards including staked ones; `useRedeemedCards`
  - `lib/use-stock-cards.ts`
  - `components/stock-card-collection.tsx`: live collection with stake, claim, unstake, fill and redeem
- Profiles: `components/profile-cards.tsx` (including the Redeemed section), `components/public-profile.tsx`
- Treasury page: `components/treasury-workspace.tsx`. Shows revenue to share, the split, the owner's withdrawable amount and a Distribute button.
- Editions (pack designs): `lib/editions.ts`. Packs are three sizes, each planned at Low / Medium / High risk. On-chain tiers (2026-11-25): **0** Fable Low $1 (on), **1** Fable Medium, **2** Fable High (both on since 2026-11-24, with an $80 pool), **3** Saga Low $3 (on), **4** duplicate Saga added by mistake (switched off on-chain, hidden in the app), **5** Mythos Low $5 (on). Planned next, in this order: **6** Saga Medium, **7** Saga High, **8** Mythos Medium, **9** Mythos High (configs in `PACK_TIERS`). Each shows "Coming soon" until its tier exists and is active.
- Demo:
  - `lib/demo-economy.ts`: pure rules. Demo staking copies CollectStaking (7-day half-life pool, rarity weights) with a simulated $500 starting pool and other stakers of weight 200; opened packs add their profit times 50%.
  - `lib/demo-store.ts`: localStorage key `collect-demo-v2`; extra keys `collect-demo-chat-v1`, `collect-demo-dao-v2`, `collect-demo-profile-v1`
  - `components/demo-provider.tsx`

## 5. Contracts (`contracts/src`)

| Contract | Runtime size | Purpose |
|---|---|---|
| CollectPacks | 23,876 B (700 B under the 24 KB limit) | Packs, cards (ERC-721), USDC pool, gifts, revenue sharing |
| CollectStaking | 4,790 B | Stake cards, earn USDC revenue with a 7-day half-life |
| CollectMarket | 7,227 B | Non-custodial card listings in AVAX or USDC, 1% fee |
| CollectPoints | 3,260 B | Non-transferable collector points (1 per pack) |
| CollectDAO | 5,319 B | Signal-only proposals and votes weighted by points (cannot spend) |
| CollectChat | 6,775 B | Rooms: open, token-gated or card-gated; encrypted holder rooms |
| CollectNames | 1,763 B | Usernames |
| CollectProfiles | 6,617 B | Profile picture from an owned or staked card, bio, social handles |

CollectPacks is close to the size limit. Any addition must be checked with `forge build --sizes`.

### 5.1 Fable pack: how $1 flows (the only tier on sale at launch)

1. **Buy.** `buy(0, qty)` pulls $1 USDC per pack into CollectPacks (the contract is the pool). It reserves the top payout, $0.95, and awards 1 point.
2. **Open.** From the next block, the block hash rolls:
   - **Token:** one of the 5 active assets, equally likely.
   - **Rarity:** 50/25/20/5%. Rarity doesn't change the value in Fable Low; it only changes the card's look and staking weight.
   - After 256 blocks the hash is gone and the pack opens as the lowest rarity.
3. **Swap.** In the same transaction, $0.95 USDC is swapped into the token (Uniswap v3 routes; LFJ v1 for JOE) and locked in the card.
   - The swap must return at least the Chainlink fair amount minus a per-asset slippage limit: 1.5% for BTC and AVAX, 2% ETH, 4% LINK, 7% JOE.
   - If it can't, the card holds $0.95 USDC and anyone can call `fill(cardId)` later.
4. **Revenue.** The remaining $0.05 per pack is added to `pendingRevenue`, as is each opened pack's price minus its card value. Market USDC fees join it through `addRevenue`.
5. **`distribute()`.** Anyone can call it. It sends `stakingBps` to the staking contract and `daoBps` to the DAO wallet; the rest becomes the owner's surplus.
   - `withdraw` and `withdrawAll` call it first and can never take what players are owed (`reserved()`), tokens locked in cards, or shares that are due (`ownerFree()`).
   - A loss makes `pendingRevenue` negative, and it is made back before anything is shared again.
   - `minBankroll` keeps a buffer in the pool before sharing (set to 0 for Fable Low).
6. **Redeem.** Burns the card and pays its tokens, or its USDC if it was never filled. The card record is kept, and `redeemedOf(wallet)` lists it, so profiles can still show redeemed cards.
7. **Pause.** Stops sales; buyers can `refund` unopened packs at the price they paid.

Fable Low needs **no starting money**: a card never pays more than the $1 it was bought for. Tier config is in `contracts/script/MainnetConfig.sol`:

- Low risk: backing `[0.95e6 ×4]`
- Medium risk: `[0.46, 0.8, 1.4, 4]`
- High risk: `[0.2, 0.6, 2.8, 10.13]`, odds 60/25/12/3

The deploy script switches tiers 1 and 2 off. Turning them back on is `setTierActive`.

### 5.2 Staking (`CollectStaking.sol`)

- **Rewards come only from revenue.** Nothing is minted and there is no fixed rate. USDC arrives from `distribute()` and joins one pool.
- **Payout:** the pool pays out continuously with a **7-day half-life** (half in 7 days, about 95% in 30). `keptAfter(dt)` computes 2^(−dt/7d) in fixed point.
- New revenue starts decaying from when it arrives (never paid for time already passed). While nothing is staked, the pool waits.
- **Weights by rarity:** Common 1, Rare 2, Epic 4, Legendary 10. Rewards accrue per second through a reward-per-weight accumulator.
- **Custodial:** a staked card sits in the contract and can't be sold or redeemed until unstaked. `claim(ids)` keeps cards staked; `unstake(ids)` returns them with their rewards. There is no owner.
- **Views:** `pending(id)`, `poolNow()`, `payoutPerDay()`, `stakedBy(addr)`, `stakes(id)` (matches CollectProfiles' `IStakes`).
- `heldOf(owner, asset)` counts wallet plus staked cards. The deploy points the holder chat rooms and CollectProfiles at the staking contract, so staked cards still open rooms and work as avatars.

### 5.3 Market

- USDC fees go to the pack pool as revenue (`setTreasury(packs, true)` in the deploy).
- AVAX fees stay in the market contract until the owner calls `withdrawAvaxFees`. They are not part of revenue sharing.

## 6. Deploying (the user runs this; agents must never broadcast)

```bash
cd contracts
# dry run (simulates against mainnet, sends nothing)
STAKING_BPS=5000 DAO_ADDRESS=0x... DAO_BPS=0 forge script script/DeployCollectPacks.s.sol --rpc-url avalanche --account collect-deployer
# real deploy
STAKING_BPS=5000 forge script script/DeployCollectPacks.s.sol --rpc-url avalanche --account collect-deployer --broadcast --verify
```

- Needs `AVALANCHE_RPC_URL`. `--verify` reads `SNOWTRACE_API_KEY` (Routescan accepts any value); or verify afterwards with `script/verify.sh`. The deployer keystore is `collect-deployer`, with AVAX for gas.
- `STAKING_BPS` defaults to 5000. `DAO_ADDRESS` and `DAO_BPS` are optional. `NEW_OWNER` offers ownership to another address, for example a Safe, which must call `acceptOwnership()`.
- The script deploys Packs, Market, Points, DAO, Staking, Chat (a lounge plus one card room per token), Names and Profiles. It sets tiers, assets and shares, and switches the Medium and High tiers off.
- A real broadcast writes the addresses to `deployments/43114.json`. Commit and push that file so the site uses them.
- `contracts/script/verify.sh` verifies the sources (it skips zero addresses).
- The owner is the deployer for the beta. The plan is a separate treasury wallet for withdrawals: `withdrawAll(treasury)`.

## 7. Environment variables (names only; never commit `.env.local` or print values)

- `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_AVALANCHE_RPC_URL`
- `BETA_ACCESS_CODES`, `BETA_COOKIE_SECRET`
- Chat relay:
  - `RELAYER_KEY`, `RELAY_DAILY_LIMIT`, `RELAY_MAX_GWEI`
  - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` / `KV_REST_API_TOKEN`)
  - `RELAY_ALLOW_MEMORY_LIMITS` (development only)

Vercel already has the Privy and WalletConnect IDs and the beta variables for Production and Preview. Chat relay: `RELAYER_KEY` (Production, sensitive) for the relayer wallet `0xf5Fee94329Be208F982b95787809bDdc30EE53CC` (0.2 AVAX), and an Upstash Redis store connected through the Vercel Marketplace (`KV_REST_API_URL` / `KV_REST_API_TOKEN`, all environments). `.env.local` has the same three. Chat history is read through `/api/chat/messages` (Routescan), since public RPCs cap log queries at 100 blocks.

## 8. Checks

```bash
npx tsc --noEmit
npx eslint .
node --test tests/*.test.mjs                 # 21 app tests
npm run build
cd contracts && forge test --no-match-contract Fork      # 87 tests
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc forge test --match-contract Fork   # 4 mainnet-fork tests
```

All of these pass at the time of writing. The fork tests include the full Fable Low path on real pools: buy, real swap, distribute, stake, claim after 7 days.

Local preview: `.claude/launch.json` runs `npm start -p 3107` (a production server). Run `npm run build` before restarting it.

## 9. Open items

**Not done or not verified**

- [ ] After the deploy, test in a browser with a real wallet:
  - the live staking UI (Allow staking → Stake → Claim → Unstake)
  - the treasury page (Distribute, Withdraw)
  - the Review swap dialog's approve-then-swap step
  - pack purchase approval inside the confirm dialog
  - Export wallet
  - Redeemed cards on the live profile
- [ ] **Later (user asked, 2026-11-24): distribute on stake.** Today revenue only reaches the staking pool when someone calls `CollectPacks.distribute()` (Distribute on `/treasury`). Idea: `CollectStaking.stake` calls `packs.distribute()` first, so new revenue lands in the pool before a stake changes the weights. This needs a new CollectStaking deploy (and `setShares` plus repointing the chat rooms and CollectProfiles); stakers would have to unstake from the old contract. A no-redeploy option: the Stake button batches `distribute()` before `stake` in the app.
- [ ] **Distribute doesn't start the payout.** `_distribute` transfers USDC to CollectStaking but doesn't call `CollectStaking.sync()`, so `poolNow`/`payoutPerDay` show the new money while `pending` stays 0 until the next stake, claim, unstake or `sync()`. Nothing is lost; payout just starts late. Fixed in the app (2026-11-24): `/treasury` sends `sync()` after Distribute, Withdraw and Withdraw all confirm. A Distribute from elsewhere (e.g. Snowtrace) still needs a sync. Fix on redeploy: `_distribute` calls `staking.sync()`.
- [ ] DAO is hidden (`DAO_VISIBLE = false` in `lib/collect-dao.ts`): no nav link, `/dao` is a 404, no /info chapter. Contracts stay deployed; points still accrue.
- [ ] Edition-based chat rooms (Fable, Saga, Mythos, gated by holding a card of that edition) were requested but not built. CollectChat only gates by asset, so tier gating needs a `heldOf`-style count per tier, for example in CollectStaking or a small adapter contract.
- [x] **Fable Medium/High with an $80 deposit (on since 2026-11-24):** send 80 USDC to CollectPacks, `setMinBankroll(80e6)`, then `setTierActive(1, true)` / `(2, true)`. App-side risk budgets in `lib/tier-budget.ts` (Medium $52 → 17 unopened at once, High $28 → 3), max 3 per purchase, "N left" on the picker, counts from `/api/tier-usage` (unopened packs + unclaimed gifts per tier). The contract only knows one shared pool, so these budgets bind the app, not direct contract calls; the deposit is the hard ceiling. Only the buyer can open a pack: an abandoned risky pack keeps its reservation until opened (pausing lets buyers refund, which releases it). /treasury shows the budgets live.
- [ ] Before turning on Medium/High for Saga or Mythos:
  - fund the pool (each unopened $1 High pack reserves $9.13; bigger packs scale up)
  - set `minBankroll`
  - consider Chainlink VRF instead of the block hash for randomness

**User-side setup**

- [ ] Add `collectx420.vercel.app` to Privy allowed domains, the Reown (WalletConnect) allowlist and Google OAuth authorized domains. Publish the Google consent screen and rename the Privy app to "Collect".
- [x] Relayer key and Upstash store set up (2026-11-24). Fund the relayer as chat grows; it also pays gift recipients a one-time 0.01 AVAX gas top-up (`/api/gift/gas`, cap `GIFT_GAS_DAILY_LIMIT`, default 100/day).
- [ ] Create a treasury wallet for withdrawals. A Safe as owner is recommended later.

## 10. Rules for agents on this project

- Commit each finished, verified change; **don't push unless the user asks** (pushing deploys).
- **Never broadcast mainnet transactions or deploy contracts.** The user does. Use anvil test keys only on a local fork.
- Never commit `.env.local` or secrets, and never print secret values. Confirm with the user before sending secrets to Vercel.
- Keep the GitHub repo private.
- Shell gotcha: the command safety checker rejects heredocs containing `${…}`. Write edit scripts to a file and run them with `python3 -I`, or use an editor tool.
- UI style: black and white with neutral grays, clean, few words. See `AGENTS.md` for the `/v2` direction.
