import "server-only";
import { encodeAbiParameters, encodePacked, isAddress, keccak256, zeroAddress, zeroHash, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { appChain } from "@/lib/chain";
import { CREATE_ARGS_TYPE, OPENFOUR, SALE, STOCK_ADDRESSES, STYLE_INDEX } from "@/lib/onchain";

/*
 * Signs an OpenFour createToken request for the Grailio pack preset, the way four.meme's API does for its presets.
 * The signature binds the caller's address, so only that wallet can use it, and the caller pays the transaction.
 * The signing key holds no funds; it only matches Core.signer on our testnet OpenFour.
 */

type Body = { creator?: string; name?: string; symbol?: string; basket?: { ticker: string; weight: number }[]; style?: string };

const tuple = (types: string, values: readonly unknown[]) =>
  encodeAbiParameters([{ type: `tuple`, components: types.split(",").map((t, i) => ({ name: `f${i}`, type: t })) }], [values as never]);

export async function POST(req: Request) {
  const key = process.env.OPENFOUR_SIGNER_KEY?.trim();
  if (!key) return Response.json({ error: "Launching on Four.meme isn't set up on this server" }, { status: 503 });

  let body: Body;
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  const name = (body.name ?? "").trim().slice(0, 32);
  const symbol = (body.symbol ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  const creator = body.creator ?? "";
  const style = STYLE_INDEX[body.style ?? ""];
  const basket = (body.basket ?? []).filter((b) => b.weight > 0).slice(0, 4);
  if (!isAddress(creator) || !name || !symbol || style === undefined || basket.length === 0) {
    return Response.json({ error: "Missing coin details" }, { status: 400 });
  }
  const missing = basket.filter((b) => !STOCK_ADDRESSES[b.ticker]).map((b) => b.ticker);
  if (missing.length) {
    return Response.json({ error: `Not on the testnet stock market yet: ${missing.join(", ")}` }, { status: 400 });
  }

  // Weights in bps summing to exactly 10000 (rounding goes to the biggest).
  const total = basket.reduce((s, b) => s + b.weight, 0);
  const bps = basket.map((b) => Math.floor((b.weight / total) * 10_000));
  bps[bps.indexOf(Math.max(...bps))] += 10_000 - bps.reduce((s, x) => s + x, 0);
  const stocks = [...basket.map((b) => STOCK_ADDRESSES[b.ticker]), ...Array(4 - basket.length).fill(zeroAddress)] as Address[];
  const weights = [...bps, ...Array(4 - bps.length).fill(0)];

  const raiseAmount = (SALE.saleAmount * SALE.fixedPrice) / 10n ** 18n;
  const curve = tuple("uint256,uint16,bool,uint256,uint256", [SALE.fixedPrice, 0, false, SALE.tokensPerPack, SALE.saleAmount]);
  const trade = tuple("uint256,uint256,uint256,uint16,uint16,address", [SALE.saleAmount, 0n, 0n, 0, 0, zeroAddress]);
  const migrate = tuple(
    "uint256,uint256,uint256,uint16,uint256,uint256,uint8,address,address,address,address,uint16,uint16,uint16,uint16",
    [0n, SALE.duration, 0n, SALE.stockPoolBps, SALE.packPrice, SALE.tokensPerPack, style, ...stocks, ...weights],
  );

  const now = BigInt(Math.floor(Date.now() / 1000));
  const createArgs = encodeAbiParameters(CREATE_ARGS_TYPE, [{
    requestId: BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000)),
    presetId: OPENFOUR.presetId,
    validTimestamp: now + 3600n,
    createFee: 0n,
    presaleQuote: 0n,
    antiSniperEnabled: false,
    partner: zeroAddress,
    initParams: {
      name, symbol, tokenUri: "",
      maxSupply: SALE.maxSupply, saleAmount: SALE.saleAmount, raiseAmount,
      quoteAsset: OPENFOUR.wbnb, tokenSalt: zeroHash,
      tokenParams: "0x", vaultParams: "0x", curveParams: curve, tradeParams: trade, migrateParams: migrate, customDataParams: "0x",
    },
  }]);

  const digest = keccak256(encodePacked(
    ["string", "uint256", "address", "bytes32"],
    ["createOpenFourToken", BigInt(appChain.id), creator as Address, keccak256(createArgs)],
  ));
  const signature: Hex = await privateKeyToAccount(key as Hex).signMessage({ message: { raw: digest } });
  return Response.json({ createArgs, signature, core: OPENFOUR.core });
}
