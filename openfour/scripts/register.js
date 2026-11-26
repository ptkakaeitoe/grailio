// Deploys the Grailio pack preset's implementations and registers them on OUR OpenFour Registry (from fork-deploy).
//   npx hardhat run scripts/register.js --network localhost|bsctestnet
// MARKET=0x… reuses an existing stock market (e.g. the one the Flap contracts use); otherwise one is deployed with
// three demo stocks at placeholder prices (post Atlas prices later with setPrices).
const path = require("path");
const { ethers } = require("hardhat");
const { FEE_ROUTER_ABI, KIND, key, outDir, writeJson, connect } = require("./lib");

const TAGS = {
  curve: "module.curve.fair_launch",
  trade: "module.trade.fair_launch",
  customData: "module.data.fair_launch",
  migrate: "module.migrate.grailio_packs",
};

async function deploy(name, args = []) {
  const c = await ethers.deployContract(name, args);
  await c.waitForDeployment();
  const address = await c.getAddress();
  console.log(`${name} ${address}`);
  return { c, address };
}

async function main() {
  const { signer, fork, registry } = await connect();
  const wbnb = fork.addresses.wbnb;

  let market = process.env.MARKET;
  const stocks = {};
  if (!market) {
    const m = await deploy("MockStockMarket", [signer.address]);
    market = m.address;
    // Placeholder BNB prices per whole bStock; replace with Atlas prices via setPrices.
    for (const [name, symbol, price] of [["NVIDIA bStock", "NVDAB", "0.28"], ["AMD bStock", "AMDB", "0.25"], ["Tesla bStock", "TSLAB", "0.6"]]) {
      await (await m.c.list(name, symbol, ethers.parseEther(price))).wait();
      stocks[symbol] = await m.c.stocks((await m.c.stockCount()) - 1n);
    }
  }

  const vaultImpl = await deploy("OpenFourPackVault");
  const impls = {
    curve: await deploy("FairLaunchCurveModule"),
    trade: await deploy("FairLaunchTradeModule"),
    customData: await deploy("FairLaunchCustomDataModule"),
    migrate: await deploy("PackMigrateModule", [vaultImpl.address, market]),
  };
  for (const [slot, { address }] of Object.entries(impls)) {
    const tx = await registry.upsertModule(key(TAGS[slot]), address, KIND[slot], {
      moduleId: key(TAGS[slot]), version: "1.0.0", name: TAGS[slot], description: `Grailio packs ${slot}`, author: signer.address, feeShareBps: 0,
    }, true);
    await tx.wait();
  }

  const validator = await deploy("PackPresetValidator", [{ expectedPresetId: 0, requiredQuoteAsset: wbnb, market, minRaiseAmount: 0, maxRaiseAmount: 0 }]);

  const bonding = await registry.getPreset(fork.presets.bondingV1);
  const presetId = BigInt(process.env.PRESET_ID || Date.now());
  const preset = {
    id: presetId,
    name: "Grailio Stock Packs",
    description: "Fixed-price pack presale; at sell-out part of the raise funds a stock-pack vault, the rest seeds PCS V2 liquidity.",
    version: "1.0.0",
    active: true,
    createEnabled: true,
    validator: validator.address,
    tokenModuleId: fork.moduleIds.TOKEN_STANDARD,
    vaultModuleId: fork.moduleIds.VAULT_BASIC,
    curveModuleId: key(TAGS.curve),
    tradeModuleId: key(TAGS.trade),
    migrateModuleId: key(TAGS.migrate),
    tokenImplId: bonding.tokenImplId,
    customDataId: key(TAGS.customData),
    author: signer.address,
  };
  await (await registry.upsertPreset(preset)).wait();

  // Same protocol fee config as the fork's standard bonding preset.
  const feeRouter = new ethers.Contract(fork.addresses.feeRouter, FEE_ROUTER_ABI, signer);
  const cfg = await feeRouter.presetFeeConfig(fork.presets.bondingV1);
  if (cfg.active) {
    await (await feeRouter.setPresetFeeConfig(presetId, {
      protocolFeeBps: cfg.protocolFeeBps, developerFeePoolBps: cfg.developerFeePoolBps, maxProtocolDevFeeBps: cfg.maxProtocolDevFeeBps,
      maxTaxBps: cfg.maxTaxBps, maxTaxTiers: cfg.maxTaxTiers, active: true, partnerProtocolShareBps: cfg.partnerProtocolShareBps,
    })).wait();
  }

  const out = path.join(outDir, `registration-${(await ethers.provider.getNetwork()).chainId}-${process.env.HARDHAT_NETWORK || "local"}.json`);
  writeJson(out, {
    registry: fork.addresses.registry, core: fork.addresses.core, presetId, market, stocks, validator: validator.address,
    vaultImplementation: vaultImpl.address, modules: Object.fromEntries(Object.entries(impls).map(([k, v]) => [k, v.address])),
  });
  console.log(`preset ${presetId} registered; wrote ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
