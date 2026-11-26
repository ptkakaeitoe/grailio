# Grailio pack launcher for Flap Pool Launch (BSC testnet)

A Flap launcher + vault factory pair. Each launch raises funds through Flap's Portal and splits them between the
token's liquidity and a **pack vault**: a pool that sells mystery packs whose cards hold tokenized stocks (bStocks),
priced by Atlas Oracle.

## Deployed on BSC testnet (chain 97), all verified on Sourcify (exact match)

| Contract | Address |
| --- | --- |
| PackLauncherFactory | `0xeCEce195efEbFCb22064b4B621f2E7c68F5ecd72` |
| PackVaultFactory | `0x3362D7C576223FD9B96276BcdDD072f6e399E85f` |
| Launcher beacon (UpgradeableBeacon) | `0x20102DBf95a576098e876531F42458255cfC5c1a` |
| PackLauncher implementation | `0xa22Cf1274136c54aE3B5d641dd20fE1b3FC1f089` |
| Vault beacon (UpgradeableBeacon) | `0x88EA25ADcD0D6Bde55d31b6A9943354D7c39BF23` |
| PackVault implementation | `0x879bD73f8462966C5b1974E827966D6851c50D8E` |

Wiring (read on chain):
- `PackLauncherFactory.hub()` = Flap Portal `0x000042108465206185A077Edc3F3fd2b49060000`
- `PackLauncherFactory.guardian()` = Flap Guardian `0x00004d58290854c5E9880F4b5B1993c6Ad8b0000` (only it can upgrade the beacons)
- `PackLauncherFactory.pairedVaultFactory()` = `0x3362…E85f`, and `PackVaultFactory.launcherFactory()` = `0xeCEc…cd72`
- Stocks are bought from our testnet stock market `0x99AC96c9a468DfAb571e0C562d455CA3678391c0` (15 test bStocks,
  Atlas prices; pays in tBNB or Flap test USD `0x190C989D5665a0e404B444b53CAE9AbCfb600157`)

To enable on testnet (Portal admin):
- `setLauncherFactoryMultiplier(0xeCEce195efEbFCb22064b4B621f2E7c68F5ecd72, <bps>, true)`
- `setVaultFactoryMultiplier(0x3362D7C576223FD9B96276BcdDD072f6e399E85f, <bps>, true)`

## How a launch works

1. **Presale**: the launcher sells a fixed number of packs (BNB or USD quote). Buyers' coins are reserved.
2. **Launch** (sold out): via the Portal, half the supply goes to the liquidity pool at the presale's opening price; the
   raise is split between liquidity and the pack vault (a share kept as a presale reserve). If it doesn't sell out by
   the deadline, buyers get a refund.
3. **Packs**: the vault sells Low / Medium / High packs; Medium and High unlock as the pool grows. Opening a pack
   (block-hash reveal) buys the card's stock value from the market and locks it in the card NFT. Cards can be redeemed
   for the stock, or staked to earn the trading tax (split 50 pool / 30 stakers / 15 creator / 5 platform).
4. Only the Portal can create vaults; only the Flap Guardian can upgrade the launcher and vault beacons; the factories
   have no owner.

## Build and test

```bash
forge build
BSC_TESTNET_RPC_URL=https://bsc-testnet-rpc.publicnode.com forge test --match-path test/Pack.fork.t.sol -vv
```

The fork test runs against the real testnet Portal (impersonating its admin to enable the factories): full journey in
BNB and in USD, refund when not sold out, config validation, Portal-only vault creation, Guardian-only upgrades with
state preserved, and the Portal's description size limit. Result: 8 passed.

Libraries (sources only) are included under `lib/`: forge-std, OpenZeppelin, OpenZeppelin Upgradeable, Solady.
Compiler: solc 0.8.26, optimizer 200 runs, EVM cancun (see `foundry.toml`).
