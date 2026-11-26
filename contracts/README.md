# Grailio contracts

Foundry project for the pack vault on Flap Pool Launch (BSC testnet).

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

Deploys use an encrypted Foundry keystore (`cast wallet import deployer --interactive`); no private keys in files.
