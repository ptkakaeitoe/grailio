# Grailio: stock packs for memecoins

**Memecoin tax buys real stocks. Holders win them back in packs.**

A pack vault that any BNB Chain launchpad can attach to a coin. The coin's trading tax and pack sales fill a pool of **bStocks** (tokenized stocks on BNB Chain, priced by Atlas Oracle). Holders open packs; every card holds bStocks and can be burned to redeem them. **Cournot**'s odds on the pool's biggest stock decide when the riskier packs stay on sale.

Built for BNB Hack Bangkok 2026.

## How it works

1. **Launch.** The coin launches on Flap (Pool Launch) or Four.meme (OpenFour) with the vault attached. No presale.
2. **Low packs first.** Low packs pay back a flat 0.95× at every rarity and are funded by the buyer, so they sell from day one with an empty pool.
3. **The pool fills.** Trading tax and pack margin buy the coin's bStocks basket.
4. **Tiers unlock.** When the pool first reaches its thresholds (default $1,000 for Medium, $5,000 for High), those tiers unlock for good. They only sell while the pool could still pay their top prize.
5. **Risk check.** The vault asks Cournot how likely the basket's biggest stock is to drop 10%. At 25% or more, High pauses; at 50%, Medium pauses too. Low always sells.
6. **Open and redeem.** Opening a pack mints a card holding bStocks. Burn it to redeem them.

Odds are shown for every pack. Nothing here is investment advice.

## Pages

| Route | What it shows |
|---|---|
| `/` | Landing page: how the vault works |
| `/app/packs` | Pack marketplace: one shelf per coin, with its pool size and packs |
| `/app/packs/<coin>` | A coin's packs: size, risk tier, odds, the Cournot risk check, buy and open |
| `/app/stocks` | Live signed bStocks prices from Atlas, cross-checked with CoinMarketCap |
| `/studio` | Pack studio: basket, sleeve, cards, rarity tiers, tax and sale settings |
| `/launch` | Launch a coin: name, ticker, picture, launchpad, and its pack vault settings |

The marketplace uses four demo coins (`src/lib/market.ts`). Buying and opening packs, and launching, are simulated until the contracts are on BSC testnet. Prices (Atlas, CoinMarketCap) and the Cournot risk check are live.

## Run it locally

Requirements: Node.js 20 or newer.

```bash
git clone <this-repo-url>
cd <repo-folder>
npm install
cp .env.example .env.local   # then fill in the keys you have
npm run dev
```

Open http://localhost:3000.

| Variable | Used for |
|---|---|
| `ATLAS_API_KEY` | Signed bStocks prices (Atlas Oracle pull API) |
| `CMC_API_KEY` | CoinMarketCap Pro: price cross-check and market data |
| `COURNOT_API_KEY` | Optional prepaid Cournot key. Without it, the server uses Cournot's free calls (three per IP, ever) |

All keys stay on the server.

## Integrations

### Flap Pool Launch

The coin launches through a Flap Launcher Factory as a tax token, straight into a DEX pool; the vault is the coin's Flap Vault, fed by the trading tax.

- Network: BSC testnet
- Launcher: `TODO: address`
- Vault: `TODO: address`
- Example launch transaction: `TODO: tx hash`

### Four.meme via OpenFour

The same vault, attached as an OpenFour launch mechanism.

- Network: BSC testnet
- Mechanism: `TODO: address or OpenFour Hub listing`
- Example launch transaction: `TODO: tx hash`

### Atlas Oracle and CoinMarketCap

`src/lib/atlas.ts` pulls signed bStocks prices from Atlas and recovers the signer exactly like the on-chain consumer, rejecting anything not signed by Atlas. `src/lib/cmc.ts` cross-checks them against CoinMarketCap Pro. These prices value the pool, price packs and set the risk check's drop level. Server routes: `/api/atlas`, `/api/cmc`.

### Cournot Integration

**What it decides.** Whether a coin's Medium and High packs stay on sale. The pool holds real stocks; if its biggest stock is likely to fall, the riskier packs (paid from the pool) pause. Low packs are buyer-funded and always sell.

**Where and how it calls Cournot.** `POST /api/risk/<coin>` (`src/app/api/risk/[coin]/route.ts`):

1. Reads the signed Atlas price of the basket's biggest stock.
2. Asks Cournot `resolve` (free) for prediction markets matching *"Will Tesla (TSLA) stock fall below $344.88?"* (10% under the Atlas price).
3. Picks the live market closest to that level and reads its direction (`src/lib/risk.ts`): "hit (LOW) $345" means YES is the drop; "close above $340" means NO is.
4. Calls Cournot `probability` for that market (one free or prepaid call), using the same endpoints and headers as the official Cournot skill client (`src/lib/cournot.ts`).
5. Converts the result to the chance of the drop and applies the rule: 25% or more pauses High, 50% or more pauses Medium.

**How it uses the probability.** The decision gates the tier picker and the buy button on the coin's pack page. Mocked or hardcoded probabilities are never used: with no saved check, only the pool-size rule applies.

**Where users see the claim and evidence.** On each coin's pack page, the risk check panel shows the decision, Cournot's probability and when it was checked. "Claim, market and evidence" expands to the exact question sent, the Atlas price, the matched market, Cournot's YES probability, the chance of a drop (marked as added by this app), the decision, every returned assessment field and Cournot's evidence as returned.

**Calls and caching.** Page views read the saved check (`.data/risk-checks.json`); only "Run risk check" calls Cournot, at most once per coin every 30 minutes.

**Proof of a successful call.** Sanitized result of a live call made from this app (the server also logs each one as `[cournot] risk check`):

| Field | Value |
|---|---|
| Coin | Moon Cats (top stock TSLA, Atlas price $383.20) |
| Question sent | Will Tesla (TSLA) stock fall below $344.88? |
| Matched market | 24073286 · Will Tesla, Inc. (TSLA) hit (LOW) $345 Week of November 23 2026? |
| Cournot probability (YES) | 0.15 (15%) |
| Chance of drop | 15% · YES means the drop |
| Decision | Medium and High stay on sale |
| Evidence | polymarket: latest YES price 0.1500 for this market, 2026-11-26 02:49 UTC |
| Checked | 2026-11-26 02:57 UTC |

Cournot's output is an assessment of market pricing, not investment advice.

## Tech

Next.js 16, React 19, TypeScript, Tailwind CSS 4, viem.

## Roadmap

- Vault contract on BSC testnet, fed by a Flap Launcher Factory tax token; buy and open packs on-chain with bStocks payouts
- The same vault as an OpenFour mechanism
- Risk check run by a keeper on a schedule, with the decision written on-chain
- Holder votes on the basket and the pack settings
- Audit, then mainnet

## License

[MIT](LICENSE)
