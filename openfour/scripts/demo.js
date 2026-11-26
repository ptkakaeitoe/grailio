// End-to-end Grailio pack launch on our OpenFour Registry:
//   create coin → buy the whole fixed-price sale (presale packs) → migrate (stock pool + PCS V2 pair) →
//   open a pack → reveal a card → redeem the bStock.
//   npx hardhat run scripts/demo.js --network localhost|bsctestnet
// Small on purpose: a 0.05 BNB raise, 10 presale packs of 0.005 BNB.
const path = require("path");
const { ethers } = require("hardhat");
const { VAULT_ABI, outDir, readJson, writeJson, connect, signCreate } = require("./lib");

const coder = ethers.AbiCoder.defaultAbiCoder();
const E = (v) => ethers.parseEther(v);

async function mineOrWait(provider, chainId) {
  if (chainId === 97n && process.env.HARDHAT_NETWORK === "bsctestnet") {
    const start = await provider.getBlockNumber();
    while ((await provider.getBlockNumber()) < start + 2) await new Promise((r) => setTimeout(r, 1500));
  } else {
    await provider.send("evm_mine", []);
    await provider.send("evm_mine", []);
  }
}

async function main() {
  const { net, signer, others, fork, core, tools } = await connect();
  const reg = readJson(path.join(outDir, `registration-${net.chainId}-${process.env.HARDHAT_NETWORK || "local"}.json`));
  const stocks = Object.values(reg.stocks);
  if (stocks.length === 0 && !process.env.STOCKS) throw new Error("No stocks: set STOCKS=0xA,0xB");
  const basket = (process.env.STOCKS ? process.env.STOCKS.split(",") : stocks).slice(0, 4);
  const weights = basket.length === 1 ? [10000] : basket.length === 2 ? [6000, 4000] : basket.length === 3 ? [5000, 3000, 2000] : [4000, 3000, 2000, 1000];

  const saleAmount = E("100000");
  const fixedPrice = E("0.0000005"); // 0.05 BNB raise
  const tokensPerPack = E("10000"); // 0.005 BNB per presale pack
  const raiseAmount = (saleAmount * fixedPrice) / E("1");

  const curve = coder.encode(["(uint256,uint16,bool,uint256,uint256)"], [[fixedPrice, 0, false, tokensPerPack, saleAmount]]);
  const trade = coder.encode(["(uint256,uint256,uint256,uint16,uint16,address)"], [[saleAmount, 0, 0, 0, 0, ethers.ZeroAddress]]);
  const s = [...basket, ...Array(4 - basket.length).fill(ethers.ZeroAddress)];
  const w = [...weights, ...Array(4 - weights.length).fill(0)];
  const migrate = coder.encode(
    ["(uint256,uint256,uint256,uint16,uint256,uint256,uint8,address,address,address,address,uint16,uint16,uint16,uint16)"],
    [[0, 86400, 0, 5000, E("0.005"), tokensPerPack, 1, ...s, ...w]],
  );

  const createArgs = coder.encode(
    ["tuple(uint256 requestId,uint256 presetId,uint256 validTimestamp,uint256 createFee,uint256 presaleQuote,bool antiSniperEnabled,address partner,tuple(string name,string symbol,string tokenUri,uint256 maxSupply,uint256 saleAmount,uint256 raiseAmount,address quoteAsset,bytes32 tokenSalt,bytes tokenParams,bytes vaultParams,bytes curveParams,bytes tradeParams,bytes migrateParams,bytes customDataParams) initParams)"],
    [[BigInt(Date.now()), BigInt(reg.presetId), BigInt(Math.floor(Date.now() / 1000) + 3600), 0n, 0n, false, ethers.ZeroAddress,
      [process.env.TOKEN_NAME || "Chip Rush", process.env.TOKEN_SYMBOL || "CHIP", "", E("1000000"), saleAmount, raiseAmount, fork.addresses.wbnb,
        ethers.ZeroHash, "0x", "0x", curve, trade, migrate, "0x"]]],
  );
  const signature = await signCreate(signer, net.chainId, createArgs);
  await core.createToken.staticCall(createArgs, signature);
  const createRec = await (await core.createToken(createArgs, signature)).wait();
  const created = createRec.logs.map((l) => { try { return core.interface.parseLog(l); } catch { return null; } }).find((p) => p?.name === "TokenCreated");
  const token = created.args.token;
  const info = await core.tokens(token);
  const migrateModule = new ethers.Contract(info.migrateModule, ["function packVault() view returns (address)"], signer);
  const packVaultAddr = await migrateModule.packVault();
  const packVault = await ethers.getContractAt("OpenFourPackVault", packVaultAddr, signer);
  console.log(`created ${token}\n  pack vault ${packVaultAddr}`);

  // Buy the whole sale: 4 packs for a second account when there is one, the rest for the deployer.
  const buyers = others.length ? [[others[0], E("40000")], [signer, E("60000")]] : [[signer, saleAmount]];
  for (const [who, amount] of buyers) {
    const est = await tools.estimateBuy.staticCall(token, who.address, amount, 0n, "0x");
    const maxPay = (est.userPays * 10500n) / 10000n;
    await (await core.connect(who).buy(token, amount, maxPay, 0n, "0x", { value: maxPay })).wait();
    console.log(`  ${who.address} bought ${ethers.formatEther(amount)} tokens for ${ethers.formatEther(est.userPays)} BNB → ${await packVault.presalePacksOf(who.address)} packs`);
  }

  const vault = new ethers.Contract(info.vault, VAULT_ABI, signer);
  if (Number(await vault.phase()) < 3) {
    try { await (await core.migrate(token)).wait(); } catch (e) { console.log(`  migrate: ${e.shortMessage || e.message}`); }
  }
  console.log(`  phase ${await vault.phase()}, stock pool ${ethers.formatEther(await packVault.freeBalance())} BNB`);

  // Open, reveal, redeem.
  const opener = buyers[0][0];
  const openRec = await (await packVault.connect(opener).open()).wait();
  const revealId = packVault.interface.parseLog(openRec.logs.find((l) => l.address.toLowerCase() === packVaultAddr.toLowerCase())).args.revealId;
  await mineOrWait(ethers.provider, net.chainId);
  const revealRec = await (await packVault.reveal(revealId)).wait();
  const card = revealRec.logs.map((l) => { try { return packVault.interface.parseLog(l); } catch { return null; } }).find((p) => p?.name === "CardRevealed");
  console.log(`  card #${card.args.cardId}: ${card.args.rollBps / 100n}% of the pack price → ${ethers.formatEther(card.args.amount)} of ${card.args.stock}`);
  await (await packVault.connect(opener).redeem(card.args.cardId)).wait();
  const stock = await ethers.getContractAt("MockBStock", card.args.stock, signer);
  console.log(`  redeemed: ${opener.address} holds ${ethers.formatEther(await stock.balanceOf(opener.address))} ${await stock.symbol()}`);

  writeJson(path.join(outDir, `demo-${net.chainId}-${process.env.HARDHAT_NETWORK || "local"}.json`), {
    token, packVault: packVaultAddr, coreVault: info.vault, migrateModule: info.migrateModule, cardId: card.args.cardId, createTx: createRec.hash,
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
