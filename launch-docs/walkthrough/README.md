# Grailio walkthrough

The full app flow on a phone (375 px), in demo mode. Demo mode simulates the chain in the browser: the same rules as the contracts, no wallet needed. Every screen below comes from one run, in order.

**The idea in one line:** packs are presold before the coin exists, the presale buyers own the first prizes, and the coin's trading tax keeps a stock pool full. Every card holds a real tokenized stock (bStocks priced by Atlas) that you can redeem.

Contents: [Start](#1-start) · [Launch a coin](#2-launch-a-coin) · [Presale](#3-presale) · [Launch](#4-launch) · [Trading tax fills the pool](#5-trading-tax-fills-the-pool) · [Collection: stake, claim, redeem](#6-collection-stake-claim-redeem) · [Profile](#7-profile) · [Trade](#8-trade) · [Classic packs](#9-classic-packs-no-coin) · [Launch without a coin](#10-launch-without-a-coin)

---

## 1. Start

| | |
|---|---|
| <img src="01-home.jpg" width="260"> | **Home.** The pitch: holders own the gacha, tax funds the pool, stakers get revenue. |
| <img src="02-connect.jpg" width="260"> | **Connect.** Pick testnet or mainnet, then a browser wallet, or *Try the demo* (no wallet). The rest of this walkthrough uses the demo. It starts you with 0.5 BNB and 500 USDT. |

## 2. Launch a coin

The centre **+** button opens Launch. A creator picks *With coin* (a memecoin and its packs) or *Without coin* (packs only, see [step 10](#10-launch-without-a-coin)).

| | |
|---|---|
| <img src="03-launch-coin.jpg" width="260"> | **Coin.** Picture, name and ticker, like any launchpad. |
| <img src="04-launch-coin-details.jpg" width="260"> | **Details.** Optional links and a colour. The preview shows the coin, its launchpad (Flap) and the 10-pack presale. |
| <img src="05-launch-stocks.jpg" width="260"> | **Stocks.** The basket the cards draw from, each with its weight bar. Here it's the *AI chips* preset: NVDA, AMD and MU. |
| <img src="06-launch-design-pack.jpg" width="260"> | **Design: pack.** Use the defaults or customize the pack colour and cover (here the Fable art). |
| <img src="07-launch-design-cards.jpg" width="260"> | **Design: cards.** One artwork per rarity. |

## 3. Presale

The coin doesn't exist yet. Its first 10 packs are sold as a presale.

| | |
|---|---|
| <img src="08-presale-open.jpg" width="260"> | **Presale open.** 0 / 10 sold. *You buy at* and *Launches at* show the same market cap ($140): supply splits 50 / 50 between presale buyers and the pool, so presale buyers pay exactly the launch price. *At launch* shows where the raise goes: 70 % liquidity, 30 % presale prizes. |
| <img src="09-presale-bought.jpg" width="260"> | **Bought 2 packs.** 2 / 10. Each presale pack also earns coins at launch (100,000 here). |
| <img src="10-presale-filling.jpg" width="260"> | **Simulate other buyers.** In the demo, other wallets fill the rest. |

## 4. Launch

| | |
|---|---|
| <img src="11-live.jpg" width="260"> | **Live.** The presale sold out, so the coin launched with $70 liquidity and $30 of presale prizes. The stock pool starts empty. Only *Low* packs are open (they always pay 95 %). Medium and High stay locked until the pool can cover their top prize. |
| <img src="12-presale-pack.jpg" width="260"> | **Open presale packs.** Presale packs share the $30 prize reserve, and it pays out in full. |
| <img src="13-reveal-epic.jpg" width="260"> | **Reveal.** An Epic card holding $4.00 of MU, 1.33× its share of the reserve. The other pack was a Common at 0.78×. |

## 5. Trading tax fills the pool

Each trade of the coin pays a tax. It splits **50 % stock pool · 30 % card stakers · 15 % creator · 5 % platform**.

| | |
|---|---|
| <img src="14-tax-empty.jpg" width="260"> | **Before trading.** Nothing collected yet. |
| <img src="15-medium-unlocked.jpg" width="260"> | **Simulate trading.** Once the pool reaches $5, Medium unlocks (pays 30 %–150 %). |
| <img src="16-all-tiers.jpg" width="260"> | **All tiers.** At $20, High unlocks too (10 %–300 %). Medium and High both average 90 %. The pool always holds enough for the best prize of every pack sold. |
| <img src="17-high-pack.jpg" width="260"> | **Buy High.** Buying sets aside the top prize ($20) from the pool. |
| <img src="18-high-reveal.jpg" width="260"> | **Reveal.** This roll paid 50 %: a $5.00 MU card. The unused reserve and the pack price go back into the pool, so it grows. |

## 6. Collection: stake, claim, redeem

| | |
|---|---|
| <img src="19-collection.jpg" width="260"> | **Collection.** Your cards, with the stakers' share of the tax (30 %) waiting for someone to stake. |
| <img src="20-staking-live.jpg" width="260"> | **Staking.** Two cards staked. Rewards stream over 7 days (60 s in the demo), split by card value. The chart shows the pool running out with no new tax. *Claim* pays out what has streamed so far. |
| <img src="21-redeem-confirm.jpg" width="260"> | **Redeem.** Burn a card for the stock inside it: here 0.006749 MU. Staked cards must be unstaked first. |

## 7. Profile

| | |
|---|---|
| <img src="22-profile-edit.jpg" width="260"> | **Edit profile.** Username, bio, and any card you own as the avatar. |
| <img src="23-profile.jpg" width="260"> | **Profile and holdings.** BNB, USDT, the redeemed MU, and 100,000 EMBER from the presale, valued at the launch price ($14). |

## 8. Trade

| | |
|---|---|
| <img src="24-trade-stocks.jpg" width="260"> | **bStocks.** 106 tokenized stocks with signed Atlas prices, checked against CoinMarketCap. |
| <img src="25-trade-tokens.jpg" width="260"> | **Tokens.** Coins launched with packs. Ember King shows its simulated pool and volume. |
| <img src="26-trade-token-ember.jpg" width="260"> | **Trade a coin.** Buy or sell EMBER with BNB. |
| <img src="27-trade-nvda.jpg" width="260"> | **Trade a stock.** NVDA with a live chart. |
| <img src="28-trade-bought.jpg" width="260"> | **Bought.** Half the BNB swapped for 0.8289 NVDA. |

The **NFTs** tab is a card marketplace: list your cards or buy someone else's.

## 9. Classic packs (no coin)

| | |
|---|---|
| <img src="29-packs-newgen.jpg" width="260"> | **New-gen.** Coin-backed collections, sorted by trending, newest or pool size. |
| <img src="30-packs-classic.jpg" width="260"> | **Classic.** Collections with no coin, in the same card style: the built-in Classic line draws from all 105 stocks. |
| <img src="31-classic-shop.jpg" width="260"> | **Classic shop.** Draws from all 105 stocks. Same tiers: Low, Medium, High. |
| <img src="32-classic-reveal.jpg" width="260"> | **Reveal.** A Common holding $4.75 of GLW. |

## 10. Launch without a coin

| | |
|---|---|
| <img src="33-launch-without-coin.jpg" width="260"> | **Without coin.** Just a collection: name, cover, colour. No ticker, presale or tax. |
| <img src="34-launch-classic-design.jpg" width="260"> | **Stocks and design.** The *Big tech* basket with custom art. |
| <img src="35-classic-published.jpg" width="260"> | **Published.** Sunday League is listed first under Classic. |

---

### On-chain

The same mechanics run on BSC testnet as contracts: `PackVault` (pool, presale reserve, tiers, staking stream, redeem), a Flap launcher (`PackLauncher`, `PackVaultFactory`) and an OpenFour fork (`OpenFourPackVault`, `PackMigrateModule`). The Foundry suite (40 tests, including fork tests of the full journey in BNB and in Flap's testnet USD) is in `contracts/`.
