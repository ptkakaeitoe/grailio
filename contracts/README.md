# Grailio contracts

Foundry project for the stock-pack Launcher + Vault on Flap Pool Launch (BSC testnet).

- `src/packs/PackLauncher.sol` + `PackLauncherFactory.sol` — pre-launch pack presale. Packs sell before the coin
  exists; the purchase that sells the last pack launches it through the Portal. Most of the raise seeds liquidity,
  `seedBps` seeds the vault's stock pool, and buyers split 50% of the supply by packs held. Refunds if not sold out.
- `src/packs/PackVault.sol` + `PackVaultFactory.sol` — takes 80% of the coin's trading tax (BNB). Packs (presale ones
  plus packs bought here) open into card NFTs that hold a bStock; burning a card pays out the bStock. A pack opens only
  when the pool covers its top prize; each style pays 10–300% of the pack price, 90% on average (`PackTypes.sol`).
- `src/stocks/` — testnet mock bStocks and the market that sells them at owner-posted prices (from Atlas).

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
