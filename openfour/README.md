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
