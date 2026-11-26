import { parseAbi, type Address } from "viem";

/*
 * Deployed contracts on BSC Testnet (chain 97). Sources: contracts/deployments/97.json (Flap side, stock market) and
 * openfour/deployments-97.json (our OpenFour proxy set and the pack preset). Server- and client-safe.
 */

/** Atlas-priced stock market used by the OpenFour pack vaults (BNB only). */
export const MARKET: Address = "0x1Ef0217aBeF9be772d7956556f7432e3A714C4F7";

/** Mock bStocks listed on the market, by stock ticker (NVDA → NVDAB's address). */
export const STOCK_ADDRESSES: Record<string, Address> = {
  NVDA: "0x12D796E025FFF7c53454937ECAb4AeC301241872",
  AMD: "0xE00508070B9a4521c2fb725cbCe9c81FD0Af82c7",
  MU: "0x52759eC2F3f808A6891f091d42762434B40EA335",
  SKHY: "0x8473601abCEF7eAb7442551F5AC6756ca5FdaDf6",
  SPCX: "0x37412cf15f9E4beAeD9B48fAf7a1c2e1f7A8AEB1",
  RKLB: "0x633d554fec51b2f05F393eB14a7c43BD1d471EF8",
  TSLA: "0x2b08b913367d9893384B0770744cC2A5f79A7Bc8",
  SPY: "0x7643088A52FED4c2F2E1109e66353Ff62e46d5A8",
  AAPL: "0xCc8579D090b0fb51E6EeA77d9CFBcB1B2b912661",
};
export const tickerOfStock = (addr: string) =>
  Object.entries(STOCK_ADDRESSES).find(([, a]) => a.toLowerCase() === addr.toLowerCase())?.[0] ?? "";

/** Our OpenFour proxy set with the Grailio pack preset. */
export const OPENFOUR = {
  core: "0xb910c8FB21B64173befe38278DF476CE5fB1cAb1" as Address,
  tools: "0x03fA1a2D7a5372aC10625018BB4af7A08826326F" as Address,
  wbnb: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as Address,
  presetId: 1795680932522n,
};

/**
 * Flap Pool Launch: our factories (launches need Flap to enable the launcher factory). v2: BNB or USD quote, pack
 * tiers, presale reserve, card staking, 50/30/15/5 tax split. Its market is separate from the OpenFour one above.
 */
export const FLAP = {
  portal: "0x000042108465206185A077Edc3F3fd2b49060000" as Address,
  launcherFactory: "0xeCEce195efEbFCb22064b4B621f2E7c68F5ecd72" as Address,
  vaultFactory: "0x3362D7C576223FD9B96276BcdDD072f6e399E85f" as Address,
  market: "0x99AC96c9a468DfAb571e0C562d455CA3678391c0" as Address,
  /** Flap's free-mint testnet USD (faucet: abc.flap.sh/faucet), usable as a coin's quote. */
  usd: "0x190C989D5665a0e404B444b53CAE9AbCfb600157" as Address,
};

/** Sale shape every app-launched OpenFour coin uses: a 0.05 BNB fixed-price sale of 10 presale packs. */
export const SALE = {
  maxSupply: 1_000_000n * 10n ** 18n,
  saleAmount: 100_000n * 10n ** 18n,
  fixedPrice: 500_000_000_000n, // 0.0000005 BNB per token
  tokensPerPack: 10_000n * 10n ** 18n, // one presale pack = 0.005 BNB
  packPrice: 5_000_000_000_000_000n, // 0.005 BNB for packs bought after launch
  stockPoolBps: 5000,
  duration: 7n * 24n * 3600n,
};

export const STYLE_INDEX: Record<string, number> = { steady: 0, classic: 1, moonshot: 2 };

export const coreAbi = parseAbi([
  "function createToken(bytes createArgs, bytes signature) payable returns (address)",
  "function buy(address token, uint256 amount, uint256 maxQuotePayAmount, uint256 options, bytes proof) payable",
  "function tokens(address) view returns (uint32 version,address creator,uint256 presetId,address token,string name,string symbol,uint256 maxSupply,uint256 saleAmount,uint256 raiseAmount,address quoteAsset,address vault,address curveModule,address tradeModule,address migrateModule,address tokenModule,address customData,uint256 createBlock,bool exists,bool paused,bool antiSniperEnabled)",
  "event TokenCreated(uint256 requestId, uint256 indexed presetId, address indexed creator, address indexed token, string name, string symbol, uint256 maxSupply, uint256 saleAmount, uint256 raiseAmount, uint256 initialPrice, address quoteAsset, address vault, address curveModule, address tradeModule, address migrateModule, address customData, address tokenModule, string tokenMetaUri, uint256 flags, bytes encodedTags)",
]);

export const toolsAbi = parseAbi([
  "function estimateBuy(address token,address trader,uint256 amount,uint256 options,bytes proof) returns ((uint256 curveQuote, uint256 totalFee, uint256 userPays, uint256 userReceives, uint256 tokenAmount, uint256 executionPrice))",
]);

export const saleVaultAbi = parseAbi([
  "function remainingForSale() view returns (uint256)",
  "function totalRaised() view returns (uint256)",
  "function phase() view returns (uint8)",
]);

export const migrateModuleAbi = parseAbi(["function packVault() view returns (address)"]);

export const packVaultAbi = parseAbi([
  "function packsOf(address account) view returns (uint256)",
  "function presalePacksOf(address account) view returns (uint256)",
  "function freeBalance() view returns (uint256)",
  "function maxPayout() view returns (uint256)",
  "function packPrice() view returns (uint256)",
  "function tokensPerPack() view returns (uint256)",
  "function buy(uint256 quantity) payable",
  "function open() returns (uint256 id)",
  "function reveal(uint256 id) returns (uint256 cardId)",
  "function redeem(uint256 cardId)",
  "function ownerOf(uint256 id) view returns (address)",
  "event PackOpened(uint256 indexed revealId, address indexed owner, uint256 revealBlock)",
  "event CardRevealed(uint256 indexed revealId, uint256 indexed cardId, address indexed owner, address stock, uint16 rollBps, uint256 valueWei, uint256 amount, bool late)",
]);

export const marketAbi = parseAbi([
  "function priceWei(address stock) view returns (uint256)",
  "function usdPrice(address stock) view returns (uint256)",
  "function bnbUsd() view returns (uint256)",
]);

/** OpenFour's create-args layout (the struct Core decodes). */
export const CREATE_ARGS_TYPE = [{
  type: "tuple",
  components: [
    { name: "requestId", type: "uint256" },
    { name: "presetId", type: "uint256" },
    { name: "validTimestamp", type: "uint256" },
    { name: "createFee", type: "uint256" },
    { name: "presaleQuote", type: "uint256" },
    { name: "antiSniperEnabled", type: "bool" },
    { name: "partner", type: "address" },
    {
      name: "initParams",
      type: "tuple",
      components: [
        { name: "name", type: "string" },
        { name: "symbol", type: "string" },
        { name: "tokenUri", type: "string" },
        { name: "maxSupply", type: "uint256" },
        { name: "saleAmount", type: "uint256" },
        { name: "raiseAmount", type: "uint256" },
        { name: "quoteAsset", type: "address" },
        { name: "tokenSalt", type: "bytes32" },
        { name: "tokenParams", type: "bytes" },
        { name: "vaultParams", type: "bytes" },
        { name: "curveParams", type: "bytes" },
        { name: "tradeParams", type: "bytes" },
        { name: "migrateParams", type: "bytes" },
        { name: "customDataParams", type: "bytes" },
      ],
    },
  ],
}] as const;
