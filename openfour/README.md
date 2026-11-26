# Grailio on OpenFour (four.meme)

A new OpenFour launch preset (Hub): a fixed-price **pack presale** whose sell-out funds a **stock-pack vault**.

```
inner market (fixed price, sells off)          migration (sold out / soft cap / timeout)
buy tokens ──► presale packs                   stockPoolBps of the raise ──► OpenFourPackVault (BNB pool)
  (tokens bought ÷ tokensPerPack,              the rest ──► PCS V2 pair, LP to 0xdead
   recorded by FairLaunch CustomData)
                                               open ─► reveal (next block hash) ─► card NFT holding a bStock
                                               redeem ─► the bStock          buy ─► more packs, all into the pool
```

| Slot | Module | Source |
| --- | --- | --- |
| Token | `TOKEN_STANDARD` | reused from the fork |
| Vault | `VAULT_BASIC` (StandardVault) | reused from the fork |
| Curve | `FairLaunchCurveModule` (fixed price, sells disabled) | OpenFour starter (MIT) |
| Trade | `FairLaunchTradeModule` | OpenFour starter (MIT) |
| CustomData | `FairLaunchCustomDataModule` (per-buyer purchases = presale packs) | OpenFour starter (MIT) |
| Migrate | **`PackMigrateModule`** (`module.migrate.grailio_packs`) | `contracts/packs/` |
| Validator | **`PackPresetValidator`** | `contracts/packs/` |

- `PackMigrateModule` clones one `OpenFourPackVault` per coin at create, so buyers see their presale packs during the
  sale. At migration it sends `stockPoolBps` (max 50%) of the raise to that vault and seeds the pair with the rest.
  The vault implementation and the stock market are immutables of the module, so a creator cannot redirect the pool.
- `OpenFourPackVault` follows the same rules as the Flap `PackVault`: packs pay 10–300% of the pack price depending on
  the style, 90% on average; a pack opens only when the pool covers its top prize; nobody can withdraw the pool.
- `contracts/openfour/` holds OpenFour's MIT interfaces, types and FairLaunch modules, unchanged.
- `contracts/stocks/` is a mock bStock market for testnet (same as the Foundry one in `../contracts`).

Compiler settings are OpenFour's required ones: solc 0.8.24, optimizer 200, viaIR, OpenZeppelin 4.9.6.

## Deployed (BNB Testnet)

Our OpenFour proxy set and the pack preset are live; a full launch has run on it. All addresses are in
`deployments-97.json`.

| | Address |
| --- | --- |
| OpenFour Registry (ours) | [`0x0dF0FC99A64A8a05835D8122fc754012769f3968`](https://testnet.bscscan.com/address/0x0dF0FC99A64A8a05835D8122fc754012769f3968) |
| OpenFour Core (ours) | [`0xb910c8FB21B64173befe38278DF476CE5fB1cAb1`](https://testnet.bscscan.com/address/0xb910c8FB21B64173befe38278DF476CE5fB1cAb1) |
| PackMigrateModule | [`0x2D3e682daC66F506Cac3866AD82dF7ebeFE963dd`](https://testnet.bscscan.com/address/0x2D3e682daC66F506Cac3866AD82dF7ebeFE963dd) |
| PackPresetValidator | [`0xC964812d7a6418461D9E4462eab9fcfCB40a3A53`](https://testnet.bscscan.com/address/0xC964812d7a6418461D9E4462eab9fcfCB40a3A53) |
| Preset id | `1795680932522` |
| Stock market (shared with Flap, Atlas BNB/USD) | [`0x1Ef0217aBeF9be772d7956556f7432e3A714C4F7`](https://testnet.bscscan.com/address/0x1Ef0217aBeF9be772d7956556f7432e3A714C4F7) |
| Demo coin | [`0x284f3d72b3632F8995C9B514D7eE4BfEd1a99846`](https://testnet.bscscan.com/address/0x284f3d72b3632F8995C9B514D7eE4BfEd1a99846) |
| Its pack vault | [`0x17500b97bbBd63C4F6f7f6C1833b4C6AdD44f05E`](https://testnet.bscscan.com/address/0x17500b97bbBd63C4F6f7f6C1833b4C6AdD44f05E) |

## Run it

OpenFour only lets officials write the real Registry, so presets are built on a developer-owned proxy set made by
OpenFour's [fork-deploy](https://github.com/four-meme-community/openfour-docs/tree/main/developer/fork-deploy). You
own its Registry and sign `createToken` yourself.

```bash
npm install
npx hardhat compile
```

Local (a fork of BSC Testnet with free BNB):

```bash
anvil --fork-url https://bsc-testnet.publicnode.com --chain-id 97 --block-base-fee-per-gas 0
# in openfour-docs/developer/fork-deploy, with anvil's first test key and RPC_URL=http://127.0.0.1:8545:
node fork-from-chain.js
cp <openfour-docs>/developer/fork-deploy/out/fork-deployment.json out/fork.json
npx hardhat run scripts/register.js --network localhost
npx hardhat run scripts/demo.js --network localhost
```

BSC Testnet: the same steps with `--network bsctestnet` and the default public RPC. The scripts read
`DEPLOYER_PRIVATE_KEY` from `.env` (OpenFour's convention), so use a fresh wallet that only ever holds testnet BNB.
Measured on the fork: the whole run (fork-deploy, register, demo) is ~59M gas, about 0.006 tBNB at 0.1 gwei, plus the
demo's 0.05 tBNB raise.

`MARKET=0x…` makes `register.js` reuse an existing stock market (for example the one the Flap contracts use).
