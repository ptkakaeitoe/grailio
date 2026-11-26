# Grailio contracts

Foundry project for the stock-pack Launcher + Vault on Flap Pool Launch (BSC testnet).

- `src/packs/PackLauncher.sol` + `PackLauncherFactory.sol` — pre-launch pack presale, priced in BNB or an ERC20 quote
  (Flap's testnet USD). The purchase that sells the last pack launches the coin through the Portal: half the supply
  and most of the raise seed the pool, `seedBps` of the raise funds the presale packs, and buyers split the other half
  by packs held, at the price the pool opens at. All tax goes to the vault, for the longest duration the Portal allows. Refunds if not sold out.
- `src/packs/PackVault.sol` + `PackVaultFactory.sol` — splits the tax 50% stock pool / 30% card stakers / 15% creator /
  5% platform. Pack tiers (`PackTypes.sol`): Low always pays 95% and can always be bought; Medium (30–150%) and High
  (10–300%) average 90% and unlock while the pool covers their top prize. Presale packs share the presale reserve and
  pay it out exactly. Cards are NFTs holding a bStock; stake them to earn tax (by card value, streamed over 7 days), or
  burn them for the bStock.
- `src/stocks/` — testnet mock bStocks and the market that sells them: USD prices posted from Atlas's signed stock
  prices; BNB buys convert with Atlas's on-chain BNB/USD feed, USD buys at $1.

- `src/flap/` — Flap's Pool Launch spec (Launcher/Vault bases and interfaces), copied unchanged from
  [flap-sh/FlapPoolLaunchVaultExample](https://github.com/flap-sh/FlapPoolLaunchVaultExample) (MIT). Flap only enables
  factories built on these bases, so they must not be edited.
- `test/ForkBase.sol`, `test/ForkAddresses.sol` — Flap's BSC testnet fork-test helpers, from the same repo.

## Setup

```bash
cd contracts
forge install --no-git foundry-rs/forge-std@978ac6fadb62f5f0b723c996f64be52eddba6801 \
  OpenZeppelin/openzeppelin-contracts@dc44c9f1a4c3b10af99492eed84f83ed244203f6 \
  OpenZeppelin/openzeppelin-contracts-upgradeable@2d081f24cac1a867f6f73d512f2022e1fa987854 \
  vectorized/solady@acd959aa4bd04720d640bf4e6a5c71037510cc4b
forge build
```

## Deployed (BNB Testnet)

| Contract | Address |
| --- | --- |
| PackLauncherFactory | [`0xBD8fd9B24054A4332B54e43f77c14304C0cA6B61`](https://testnet.bscscan.com/address/0xBD8fd9B24054A4332B54e43f77c14304C0cA6B61) |
| PackVaultFactory | [`0x975CB1bAEAA498B276EdC455681dEFe605Ca2EF7`](https://testnet.bscscan.com/address/0x975CB1bAEAA498B276EdC455681dEFe605Ca2EF7) |
| MockStockMarket (Atlas prices; BNB or Flap testnet USD) | [`0x014497A15e5e16eBf12E6c6aA763fa0cCFa87B37`](https://testnet.bscscan.com/address/0x014497A15e5e16eBf12E6c6aA763fa0cCFa87B37) |

All addresses, including the nine mock bStocks, are in `deployments/97.json`.

## Test

```bash
forge test                                                            # unit tests
BSC_TESTNET_RPC_URL=https://bsc-testnet.publicnode.com forge test     # plus the fork tests on the live Portal
```

## Deploy (BNB Testnet)

```bash
cast wallet import deployer --interactive
forge script script/Deploy.s.sol --rpc-url https://bsc-testnet.publicnode.com --account deployer --broadcast
```

Then ask Flap to enable the printed `PackLauncherFactory`.

Deploys use an encrypted Foundry keystore (`cast wallet import deployer --interactive`); no private keys in files.
