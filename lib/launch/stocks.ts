/**
 * Every bStock live on BNB Smart Chain, from bStocks' own list
 * (https://www.bstocks.finance → /bapi/asset/v2/public/asset/asset/get-tokenised-asset), fetched 2026-11-25.
 * Each address was checked on-chain the same day: deployed code, the official bStocks beacon
 * (0x156d6dce9a4f6139a3406f1f021f1a4880de93a3), matching symbol() and non-zero supply.
 *
 * feedId: Atlas Oracle feed, or null when Atlas doesn't price it yet (the vault can't buy those).
 * price: reference USD price from Atlas at fetch time. Live prices come from /api/atlas.
 * multiplier: bStocks' share multiplier for splits and dividends (1 for most).
 */
export type Stock = {
  ticker: string;
  symbol: string;
  name: string;
  address: `0x${string}`;
  multiplier: number;
  feedId: number | null;
  price: number | null;
  accent: string;
  kind: "stock" | "etf";
  logo: string;
};

export const STOCKS: Stock[] = [
  { ticker: "TSLA", symbol: "TSLAB", name: "Tesla", address: "0x5b1910eaad6450e50f816082aa078c41f10c292f", multiplier: 1, feedId: 933, price: 374.2013, accent: "#e03131", kind: "stock", logo: "/logos/TSLAB.png" },
  { ticker: "NVDA", symbol: "NVDAB", name: "NVIDIA", address: "0x02fca66c1d1afb4e2a7884261eb00f63598a7436", multiplier: 1.0007782237528078, feedId: 934, price: 147.4491, accent: "#74b816", kind: "stock", logo: "/logos/NVDAB.png" },
  { ticker: "SNDK", symbol: "SNDKB", name: "SanDisk", address: "0x3ee4df61bd4f867e349beae8bfe07bc31b4850fb", multiplier: 8.0, feedId: 935, price: 584.1093, accent: "hsl(201 55% 45%)", kind: "stock", logo: "/logos/SNDKB.png" },
  { ticker: "MU", symbol: "MUB", name: "Micron Technology", address: "0xcdf2f3e0fa43c47a6662a91c9e4a7c5f69762699", multiplier: 1.0002173570133537, feedId: 937, price: 592.6943, accent: "#5f3dc4", kind: "stock", logo: "/logos/MUB.png" },
  { ticker: "CRCL", symbol: "CRCLB", name: "Circle Internet Group", address: "0x80f3d493ebce97e343c53d29a137942416b4ffc0", multiplier: 1, feedId: 936, price: 46.6789, accent: "#0c8599", kind: "stock", logo: "/logos/CRCLB.png" },
  { ticker: "SPCX", symbol: "SPCXB", name: "SpaceX", address: "0xbe9d156892e55e7154bcd3cb0fea677f9d3103e1", multiplier: 1, feedId: 938, price: 122.3689, accent: "#212529", kind: "stock", logo: "/logos/SPCXB.png" },
  { ticker: "AMD", symbol: "AMDB", name: "Advanced Micro Devices", address: "0x75fd4cf6f8392e41e70391d60c90c0d5211603a1", multiplier: 1, feedId: 942, price: 388.9528, accent: "#2b8a3e", kind: "stock", logo: "/logos/AMDB.png" },
  { ticker: "INTC", symbol: "INTCB", name: "Intel", address: "0xe614e2fc6c787035ff51f452e8e826bfd32d5283", multiplier: 1, feedId: 940, price: 52.6503, accent: "hsl(261 55% 45%)", kind: "stock", logo: "/logos/INTCB.png" },
  { ticker: "MSTR", symbol: "MSTRB", name: "Strategy", address: "0xe87afb3076aeb0f9b14e368de8145ae6a2826a14", multiplier: 1, feedId: 939, price: 76.0409, accent: "#e8590c", kind: "stock", logo: "/logos/MSTRB.png" },
  { ticker: "EWY", symbol: "EWYB", name: "iShares MSCI South Korea ETF", address: "0xbe82f76637dba2c114c41df856c2c51e522e2cb8", multiplier: 1, feedId: 941, price: 126.2035, accent: "hsl(66 55% 45%)", kind: "etf", logo: "/logos/EWYB.png" },
  { ticker: "MSFT", symbol: "MSFTB", name: "Microsoft", address: "0x80106cb3ead06659a5ad19df39d9b4733863b9b0", multiplier: 1.0026670918142742, feedId: 943, price: 486.7963, accent: "#1c7ed6", kind: "stock", logo: "/logos/MSFTB.png" },
  { ticker: "QQQ", symbol: "QQQB", name: "Invesco QQQ Trust", address: "0x205812cdbed920aff76c6580abd681a46d11efc7", multiplier: 1.0007248386575731, feedId: 947, price: 622.5377, accent: "hsl(230 55% 45%)", kind: "etf", logo: "/logos/QQQB.png" },
  { ticker: "META", symbol: "METAB", name: "Meta", address: "0x7425889fe94f9d693e8daefe88bcced6acfef4c0", multiplier: 1.000548290410745, feedId: 944, price: 580.1413, accent: "#4263eb", kind: "stock", logo: "/logos/METAB.png" },
  { ticker: "LITE", symbol: "LITEB", name: "Lumentum", address: "0x64748bea17b6d19e242adf20425de2440c656142", multiplier: 1, feedId: 946, price: 460.2625, accent: "hsl(351 55% 45%)", kind: "stock", logo: "/logos/LITEB.png" },
  { ticker: "PLTR", symbol: "PLTRB", name: "Palantir", address: "0x0ca5d51d0277bd006fd9607d3e560785ebad8222", multiplier: 1, feedId: 945, price: 154.3374, accent: "hsl(131 55% 45%)", kind: "stock", logo: "/logos/PLTRB.png" },
  { ticker: "GOOGL", symbol: "GOOGLB", name: "Alphabet", address: "0x3f53de71c126bdabae20f9cd64848d317f6c3238", multiplier: 1.0004780589781075, feedId: 952, price: 270.2952, accent: "#f59f00", kind: "stock", logo: "/logos/GOOGLB.png" },
  { ticker: "QCOM", symbol: "QCOMB", name: "Qualcomm", address: "0x5f7a56e877b9130608bf8be962621011182fefe1", multiplier: 1.00380432322353, feedId: 954, price: 159.4914, accent: "hsl(235 55% 45%)", kind: "stock", logo: "/logos/QCOMB.png" },
  { ticker: "COIN", symbol: "COINB", name: "Coinbase", address: "0x585bde7c54abb5ccd7791f923d6c2187635f3952", multiplier: 1, feedId: 949, price: 100.4692, accent: "#1971c2", kind: "stock", logo: "/logos/COINB.png" },
  { ticker: "SPY", symbol: "SPYB", name: "SPDR S&P 500 ETF", address: "0x7138b48df7d98d7e3cc221bfe7192d0a178182d8", multiplier: 1.0017297920368353, feedId: 956, price: 709.2897, accent: "#495057", kind: "etf", logo: "/logos/SPYB.png" },
  { ticker: "WDC", symbol: "WDCB", name: "Western Digital", address: "0xebe29695f8047c13d36e7a790ca8c1b239ffad1c", multiplier: 1.000224983929809, feedId: 957, price: 260.2053, accent: "hsl(182 55% 45%)", kind: "stock", logo: "/logos/WDCB.png" },
  { ticker: "GLW", symbol: "GLWB", name: "Corning", address: "0x740e075cbbea22a082b9d6679e65e82767875b6a", multiplier: 1.0028858212864586, feedId: 951, price: 97.5664, accent: "hsl(72 55% 45%)", kind: "stock", logo: "/logos/GLWB.png" },
  { ticker: "NBIS", symbol: "NBISB", name: "Nebius", address: "0xe256bc2a4f5297f8ba6f043f180a46300ecbcbb1", multiplier: 1, feedId: 953, price: 82.0411, accent: "hsl(228 55% 45%)", kind: "stock", logo: "/logos/NBISB.png" },
  { ticker: "SOXL", symbol: "SOXLB", name: "Semicon Bull 3X ETF", address: "0xd97d097a89113fa59b76c572e5b2eb647e8eefaf", multiplier: 1.0004419392788633, feedId: 955, price: 28.2053, accent: "#9c36b5", kind: "etf", logo: "/logos/SOXLB.png" },
  { ticker: "DRAM", symbol: "DRAMB", name: "Roundhill Memory ETF", address: "0x93862d63fd9fd488b1328e9b47717d75e994a84b", multiplier: 1, feedId: 950, price: 33.8453, accent: "hsl(53 55% 45%)", kind: "etf", logo: "/logos/DRAMB.png" },
  { ticker: "CBRS", symbol: "CBRSB", name: "Cerebras", address: "0xe81c6bb0266cd68b4f17278531dd03ea1f12da4e", multiplier: 1, feedId: 948, price: 84.8539, accent: "hsl(319 55% 45%)", kind: "stock", logo: "/logos/CBRSB.png" },
  { ticker: "SKHY", symbol: "SKHYB", name: "SK Hynix", address: "0xca750ef65f295bbecd685abf54e82caf297bdb61", multiplier: 1, feedId: 958, price: 106.0812, accent: "hsl(245 55% 45%)", kind: "stock", logo: "/logos/SKHYB.png" },
  { ticker: "ARM", symbol: "ARMB", name: "ARM", address: "0xd42a79ebb7f527f40faecd196ffb47ad5e8d6f8c", multiplier: 1, feedId: 960, price: 152.1634, accent: "hsl(14 55% 45%)", kind: "stock", logo: "/logos/ARMB.png" },
  { ticker: "AAOI", symbol: "AAOIB", name: "Applied Optoelectronics", address: "0x10343ef7da3301493d7ecb647d68a288c6c1db2f", multiplier: 1, feedId: 959, price: 36.3827, accent: "hsl(180 55% 45%)", kind: "stock", logo: "/logos/AAOIB.png" },
  { ticker: "IBM", symbol: "IBMB", name: "IBM", address: "0xfa273b076feb8c0fb34e554ae341082323d016a3", multiplier: 1.0097614890770965, feedId: 964, price: 235.5921, accent: "hsl(54 55% 45%)", kind: "stock", logo: "/logos/IBMB.png" },
  { ticker: "RKLB", symbol: "RKLBB", name: "Rocket Lab", address: "0xc8da12cbcce7c45180692a6420b0076e03a5179a", multiplier: 1, feedId: 967, price: 44.4031, accent: "hsl(43 55% 45%)", kind: "stock", logo: "/logos/RKLBB.png" },
  { ticker: "NOK", symbol: "NOKB", name: "Nokia", address: "0x7c4d7a180d737dd5a70d8065a90e6746a69c37ea", multiplier: 1.0041153947003976, feedId: 966, price: 7.1561, accent: "hsl(211 55% 45%)", kind: "stock", logo: "/logos/NOKB.png" },
  { ticker: "TSM", symbol: "TSMB", name: "TSMC", address: "0xab78b89b5bb00236be0b4b20704cbfa04efc711c", multiplier: 1.002110464141051, feedId: 968, price: 338.5958, accent: "hsl(293 55% 45%)", kind: "stock", logo: "/logos/TSMB.png" },
  { ticker: "BABA", symbol: "BABAB", name: "Alibaba", address: "0x4ef9d3062c7f6eba4aae4990c5036598c6eff4ec", multiplier: 1, feedId: 962, price: 82.5452, accent: "hsl(138 55% 45%)", kind: "stock", logo: "/logos/BABAB.png" },
  { ticker: "AVGO", symbol: "AVGOB", name: "Broadcom", address: "0x76682c454467b3a1150ad8b6a92fc5ee2c21d7ed", multiplier: 1.0012692086112582, feedId: 961, price: 290.1161, accent: "hsl(41 55% 45%)", kind: "stock", logo: "/logos/AVGOB.png" },
  { ticker: "MRVL", symbol: "MRVLB", name: "Marvell Technology", address: "0x16cd4fe7e8880ecc3ba222795229e20489fc2c76", multiplier: 1.0001532846716032, feedId: 965, price: 124.3309, accent: "hsl(153 55% 45%)", kind: "stock", logo: "/logos/MRVLB.png" },
  { ticker: "HOOD", symbol: "HOODB", name: "Robinhood", address: "0xa394dcea3fd3847fd793afbfd163e2e3858b7c65", multiplier: 1, feedId: 963, price: 63.5056, accent: "hsl(318 55% 45%)", kind: "stock", logo: "/logos/HOODB.png" },
  { ticker: "MVLL", symbol: "MVLLB", name: "GraniteShares 2X Long MRVL ETF", address: "0x7c26a12f20507e2cee22ceebed9e88fda47f866c", multiplier: 1, feedId: 973, price: 6.1497, accent: "hsl(342 55% 45%)", kind: "etf", logo: "/logos/MVLLB.png" },
  { ticker: "KORU", symbol: "KORUB", name: "South Korea Bull 3X ETF", address: "0x1ffad32d69c5fead99f88c25ca0191edc3757636", multiplier: 1, feedId: 969, price: 4.9237, accent: "hsl(243 55% 45%)", kind: "etf", logo: "/logos/KORUB.png" },
  { ticker: "AXTI", symbol: "AXTIB", name: "AXT", address: "0x9bdc8b470dbf89dbcb123587c6f5e49cca3463be", multiplier: 1, feedId: 970, price: 29.7768, accent: "hsl(209 55% 45%)", kind: "stock", logo: "/logos/AXTIB.png" },
  { ticker: "CRWV", symbol: "CRWVB", name: "CoreWeave", address: "0x33e7317e17838fee56b10fe8d0b9ca6ca3090c95", multiplier: 1, feedId: 971, price: 40.0494, accent: "hsl(36 55% 45%)", kind: "stock", logo: "/logos/CRWVB.png" },
  { ticker: "MUU", symbol: "MUUB", name: "Direxion MU Bull 2X ETF", address: "0x0bb3fa77e0809f42948e435f04883c25415e8263", multiplier: 1.0039519680686277, feedId: 972, price: 9.1629, accent: "hsl(84 55% 45%)", kind: "etf", logo: "/logos/MUUB.png" },
  { ticker: "SNXX", symbol: "SNXXB", name: "Tradr 2X Long SNDK ETF", address: "0x9e82e3da8f1115b73d24bb24113ab836ffdab6b6", multiplier: 1, feedId: 974, price: 1.4382, accent: "hsl(134 55% 45%)", kind: "etf", logo: "/logos/SNXXB.png" },
  { ticker: "INTW", symbol: "INTWB", name: "GraniteShares 2X Long INTC ETF", address: "0x0735d9904b7e34e6fe39b0f66e00c111b3f2b681", multiplier: 1, feedId: 975, price: 4.4342, accent: "hsl(353 55% 45%)", kind: "etf", logo: "/logos/INTWB.png" },
  { ticker: "TQQQ", symbol: "TQQQB", name: "ProShares UltraPro QQQ", address: "0x462b5f13b7c7748279358962925c5de83bb9e598", multiplier: 1.001347622058686, feedId: 976, price: 42.7805, accent: "#c2255c", kind: "etf", logo: "/logos/TQQQB.png" },
  { ticker: "QNT", symbol: "QNTB", name: "Quantinuum", address: "0xd721c192d612db77621df57a9fab38418033c02e", multiplier: 1, feedId: 977, price: 29.162, accent: "hsl(152 55% 45%)", kind: "stock", logo: "/logos/QNTB.png" },
  { ticker: "ORCL", symbol: "ORCLB", name: "Oracle", address: "0x4684d9887fc1c71cba7bab8e88835cec217eb598", multiplier: 1.0025718274672117, feedId: 978, price: 104.9078, accent: "hsl(111 55% 45%)", kind: "stock", logo: "/logos/ORCLB.png" },
  { ticker: "AAPL", symbol: "AAPLB", name: "Apple", address: "0x431a3bee82e2ca41e49895cbece5bb0f76a89b7a", multiplier: 1.00113542417086, feedId: 979, price: 351.9826, accent: "#868e96", kind: "stock", logo: "/logos/AAPLB.png" },
  { ticker: "BE", symbol: "BEB", name: "Bloom Energy", address: "0x5519de00f5388c17d886b97cb5d2d43a812a82bc", multiplier: 1, feedId: 982, price: 147.0389, accent: "hsl(31 55% 45%)", kind: "stock", logo: "/logos/BEB.png" },
  { ticker: "AMZN", symbol: "AMZNB", name: "Amazon", address: "0x1a4b499833a79a09ad7cf1d42d7dacf71e92eb00", multiplier: 1, feedId: 981, price: 244.2552, accent: "hsl(196 55% 45%)", kind: "stock", logo: "/logos/AMZNB.png" },
  { ticker: "SOXS", symbol: "SOXSB", name: "Direxion Semiconductor Bear 3X ETF", address: "0xe28cd11c99af2df76bb8ada4cd0ef3904378280f", multiplier: 1.0090262198541071, feedId: 988, price: 70.0349, accent: "hsl(341 55% 45%)", kind: "etf", logo: "/logos/SOXSB.png" },
  { ticker: "DELL", symbol: "DELLB", name: "Dell", address: "0x0e7a51966c66648999d506e1372efdea1b78cb0b", multiplier: 1.0009618320644202, feedId: 983, price: 274.3398, accent: "hsl(107 55% 45%)", kind: "stock", logo: "/logos/DELLB.png" },
  { ticker: "FLNC", symbol: "FLNCB", name: "Fluence Energy", address: "0x4af1d41cd9dd950dca43984b43aaa2a8702714ac", multiplier: 1, feedId: 984, price: 3.8899, accent: "hsl(357 55% 45%)", kind: "stock", logo: "/logos/FLNCB.png" },
  { ticker: "AMAT", symbol: "AMATB", name: "Applied Materials", address: "0xa304bd78e739c0f777202b3eb73ac3736d1df801", multiplier: 1.0017854888683415, feedId: 980, price: 307.7047, accent: "hsl(27 55% 45%)", kind: "stock", logo: "/logos/AMATB.png" },
  { ticker: "PYPL", symbol: "PYPLB", name: "Paypal", address: "0x2806a561fc1f9259b2d54a281796bde0d92762ae", multiplier: 1.0017717788129643, feedId: 986, price: 55.5141, accent: "hsl(337 55% 45%)", kind: "stock", logo: "/logos/PYPLB.png" },
  { ticker: "GS", symbol: "GSB", name: "Goldman Sachs", address: "0x20cce6656e5f7f79f280e2d0f5db55b401bdbfce", multiplier: 1.0034062788407505, feedId: 985, price: 796.8479, accent: "hsl(224 55% 45%)", kind: "stock", logo: "/logos/GSB.png" },
  { ticker: "SMH", symbol: "SMHB", name: "VanEck Semiconductor ETF", address: "0xbe1fced7047fdce935f45700727845df2c76877a", multiplier: 1, feedId: 987, price: 410.049, accent: "hsl(114 55% 45%)", kind: "etf", logo: "/logos/SMHB.png" },
  { ticker: "ALAB", symbol: "ALABB", name: "Astera Labs", address: "0x1282493ede6a22753d45cb2c0fdbd8d35e97555a", multiplier: 1, feedId: 989, price: 180.2155, accent: "hsl(141 55% 45%)", kind: "stock", logo: "/logos/ALABB.png" },
  { ticker: "USAR", symbol: "USARB", name: "USA Rare Earth", address: "0xcd345d4450e04cdef422a60b97d9265d24e0bcee", multiplier: 1, feedId: 998, price: 6.3563, accent: "hsl(10 55% 45%)", kind: "stock", logo: "/logos/USARB.png" },
  { ticker: "CRDO", symbol: "CRDOB", name: "Credo Technology", address: "0x6e7d451f9d30327d32020f116fa79c23b24e9c8d", multiplier: 1, feedId: 994, price: 100.7312, accent: "hsl(253 55% 45%)", kind: "stock", logo: "/logos/CRDOB.png" },
  { ticker: "COHR", symbol: "COHRB", name: "Coherent", address: "0x5131859a059b2446abeefe0f5d313b3c54ff3d36", multiplier: 1, feedId: 993, price: 189.0466, accent: "hsl(47 55% 45%)", kind: "stock", logo: "/logos/COHRB.png" },
  { ticker: "ASTS", symbol: "ASTSB", name: "AST SpaceMobile", address: "0x58b6f5feeb8436489f5bf4a56619092b1fa8e777", multiplier: 1, feedId: 991, price: 22.8898, accent: "hsl(166 55% 45%)", kind: "stock", logo: "/logos/ASTSB.png" },
  { ticker: "NFLX", symbol: "NFLXB", name: "Netflix", address: "0xd6829ea836b6fa224d099d40e54b31262f874631", multiplier: 1, feedId: 996, price: 58.2741, accent: "hsl(198 55% 45%)", kind: "stock", logo: "/logos/NFLXB.png" },
  { ticker: "ASML", symbol: "ASMLB", name: "ASML", address: "0xfbfb4f79cfb4c34dcd7c82bdee5a0fa199b2e7f9", multiplier: 1.0011203983743455, feedId: 990, price: 1288.4072, accent: "hsl(56 55% 45%)", kind: "stock", logo: "/logos/ASMLB.png" },
  { ticker: "IREN", symbol: "IRENB", name: "IREN Limited", address: "0xfdc2f2cab77b28f7ef6c819a404706cfa9bca33b", multiplier: 1, feedId: 995, price: 12.395, accent: "hsl(66 55% 45%)", kind: "stock", logo: "/logos/IRENB.png" },
  { ticker: "SMCI", symbol: "SMCIB", name: "Super Micro Computer", address: "0x387dea1d2772d716d081a29116f3effa0ffe1f36", multiplier: 1, feedId: 997, price: 21.8042, accent: "hsl(318 55% 45%)", kind: "stock", logo: "/logos/SMCIB.png" },
  { ticker: "BMNR", symbol: "BMNRB", name: "BitMine Immersion Technologies", address: "0x3548da95a9effe481e8604664d75e95821e557f5", multiplier: 1, feedId: 992, price: 12.9016, accent: "hsl(348 55% 45%)", kind: "stock", logo: "/logos/BMNRB.png" },
  { ticker: "GME", symbol: "GMEB", name: "GameStop", address: "0x46ceefda28dd7207059ed19b0acdc026955bb15c", multiplier: 1, feedId: null, price: null, accent: "hsl(331 55% 45%)", kind: "stock", logo: "/logos/GMEB.png" },
  { ticker: "DJT", symbol: "DJTB", name: "Trump Media & Technology Group", address: "0xf2ec508422174ee564de98187db9359d318afb6b", multiplier: 1, feedId: null, price: null, accent: "hsl(16 55% 45%)", kind: "stock", logo: "/logos/DJTB.png" },
  { ticker: "CRWD", symbol: "CRWDB", name: "CrowdStrike", address: "0x814981cf5df4a14d4d7328f9abf0d02e9ed54cd1", multiplier: 1, feedId: null, price: null, accent: "hsl(207 55% 45%)", kind: "stock", logo: "/logos/CRWDB.png" },
  { ticker: "STX", symbol: "STXB", name: "Seagate", address: "0x2e065f65f1699964f4092de1d39a8efe6c8d6f32", multiplier: 1.0005592471784448, feedId: null, price: null, accent: "hsl(51 55% 45%)", kind: "stock", logo: "/logos/STXB.png" },
  { ticker: "SQQQ", symbol: "SQQQB", name: "ProShares UltraPro Short QQQ", address: "0x25e572b466d152604d9e6c3e53b432b978825342", multiplier: 1.0098410162425664, feedId: null, price: null, accent: "hsl(339 55% 45%)", kind: "etf", logo: "/logos/SQQQB.png" },
  { ticker: "MRNA", symbol: "MRNAB", name: "Moderna", address: "0x5fd86da9b05abe396fe9d02a4a213a7c00556503", multiplier: 1, feedId: null, price: null, accent: "hsl(40 55% 45%)", kind: "stock", logo: "/logos/MRNAB.png" },
  { ticker: "HIMS", symbol: "HIMSB", name: "Hims & Hers", address: "0xee6f4bcc88c2c8583d5a65c7d0c877b464100711", multiplier: 1, feedId: null, price: null, accent: "hsl(205 55% 45%)", kind: "stock", logo: "/logos/HIMSB.png" },
  { ticker: "CRM", symbol: "CRMB", name: "Salesforce", address: "0x8c433eca1be0e2a357015602f63751c768f6f643", multiplier: 1.0012295093790349, feedId: null, price: null, accent: "hsl(344 55% 45%)", kind: "stock", logo: "/logos/CRMB.png" },
  { ticker: "BNC", symbol: "BNCB", name: "BNB Standard Corporation", address: "0x4902c5ebc598265ed2212b559b042de8a5eeec3f", multiplier: 1, feedId: 1069, price: 2.8862, accent: "hsl(17 55% 45%)", kind: "stock", logo: "/logos/BNCB.png" },
  { ticker: "GPRO", symbol: "GPROB", name: "GoPro", address: "0x1ecfda023c46ca216b5c620ef357a6d0c03951e6", multiplier: 1, feedId: 1053, price: 0.5093, accent: "hsl(341 55% 45%)", kind: "stock", logo: "/logos/GPROB.png" },
  { ticker: "RDDT", symbol: "RDDTB", name: "Reddit", address: "0x41622a9125a22767df8c1dc79fc17299bac4bd0b", multiplier: 1, feedId: 1054, price: 87.3207, accent: "hsl(92 55% 45%)", kind: "stock", logo: "/logos/RDDTB.png" },
  { ticker: "CYPH", symbol: "CYPHB", name: "Cypherpunk Technologies", address: "0x0393c28065c54e48b45bdb05eff5c401cf891da1", multiplier: 1, feedId: 1068, price: 1.469, accent: "hsl(256 55% 45%)", kind: "stock", logo: "/logos/CYPHB.png" },
  { ticker: "AMC", symbol: "AMCB", name: "AMC Entertainment Holdings", address: "0x96e7d606e229448ef817a7f35fd7394c3e15d00c", multiplier: 1, feedId: 1067, price: 2.898, accent: "hsl(37 55% 45%)", kind: "stock", logo: "/logos/AMCB.png" },
  { ticker: "AGPU", symbol: "AGPUB", name: "Axe Compute", address: "0xa455ae0f04a2b86eee47adca98985e61d14cbefb", multiplier: 1, feedId: 1066, price: 6.4215, accent: "hsl(162 55% 45%)", kind: "stock", logo: "/logos/AGPUB.png" },
  { ticker: "ZM", symbol: "ZMB", name: "Zoom", address: "0xf4ddb292fe88e476eddd9869d386705e6bfab7a2", multiplier: 1, feedId: 1076, price: 86.8837, accent: "hsl(205 55% 45%)", kind: "stock", logo: "/logos/ZMB.png" },
  { ticker: "HPE", symbol: "HPEB", name: "Hewlett Packard", address: "0xd56eb30d2ea7b5866dc0066d33bbaab36f7e8860", multiplier: 1, feedId: 1072, price: 38.1651, accent: "hsl(65 55% 45%)", kind: "stock", logo: "/logos/HPEB.png" },
  { ticker: "ADBE", symbol: "ADBEB", name: "Adobe", address: "0x65c0249d49e3231540fd0db0a1ae9259e6eaaf57", multiplier: 1, feedId: 1070, price: 228.0916, accent: "hsl(275 55% 45%)", kind: "stock", logo: "/logos/ADBEB.png" },
  { ticker: "SHAZ", symbol: "SHAZB", name: "SharonAI", address: "0x0f31e21b7881f5583ea94ddbcb0bcaf22b1abeab", multiplier: 1, feedId: 1074, price: 16.1772, accent: "hsl(258 55% 45%)", kind: "stock", logo: "/logos/SHAZB.png" },
  { ticker: "FWDI", symbol: "FWDIB", name: "Forward Industries", address: "0x83f1a739fae6517c4672c5e10c8ea918925eb584", multiplier: 1, feedId: 1071, price: 3.2905, accent: "hsl(67 55% 45%)", kind: "stock", logo: "/logos/FWDIB.png" },
  { ticker: "PDD", symbol: "PDDB", name: "PDD Holdings", address: "0x95b0409679b55c31772daa2fb4bee7b125b77521", multiplier: 1, feedId: 1073, price: 85.9195, accent: "hsl(59 55% 45%)", kind: "stock", logo: "/logos/PDDB.png" },
  { ticker: "WEN", symbol: "WENB", name: "Wendy's", address: "0xded1c5fb38c262beb9cff1e1116eff3c5bf278cd", multiplier: 1, feedId: 1075, price: 8.6354, accent: "hsl(273 55% 45%)", kind: "stock", logo: "/logos/WENB.png" },
  { ticker: "SECZ", symbol: "SECZB", name: "Securitize", address: "0x32c980f38907ace4fac643c3765d9b32842af60f", multiplier: 1, feedId: 1079, price: 6.967, accent: "hsl(348 55% 45%)", kind: "stock", logo: "/logos/SECZB.png" },
  { ticker: "USDE", symbol: "USDEB", name: "StablecoinX", address: "0xdfd3ba51d4591f243481a6f26059d1a5ee95252f", multiplier: 1, feedId: 1080, price: 3.624, accent: "hsl(186 55% 45%)", kind: "stock", logo: "/logos/USDEB.png" },
  { ticker: "JPM", symbol: "JPMB", name: "JPMorgan Chase", address: "0xbd49d695ba2cc46c8c603eb62afcd7fff4698281", multiplier: 1, feedId: 1077, price: 315.3014, accent: "hsl(153 55% 45%)", kind: "stock", logo: "/logos/JPMB.png" },
  { ticker: "LLY", symbol: "LLYB", name: "Eli Lilly", address: "0x5407912f1aa4b9e05cbe6abeb9721547a643ec6b", multiplier: 1.0008443496252628, feedId: 1078, price: 1420.036, accent: "hsl(217 55% 45%)", kind: "stock", logo: "/logos/LLYB.png" },
  { ticker: "MDB", symbol: "MDBB", name: "Mongodb", address: "0x2e4127e92ebc1b7909267a820c9cb508373e5a5c", multiplier: 1, feedId: 1093, price: 293.7643, accent: "hsl(118 55% 45%)", kind: "stock", logo: "/logos/MDBB.png" },
  { ticker: "BB", symbol: "BBB", name: "Blackberry", address: "0xcbb733b3dccbb983e49baac52abe7bc3a8e85a4f", multiplier: 1, feedId: 1092, price: 8.119, accent: "hsl(203 55% 45%)", kind: "stock", logo: "/logos/BBB.png" },
  { ticker: "PENG", symbol: "PENGB", name: "Penguin Solutions", address: "0x7f732f9d2f2ea3e7e223c2e737e5257007f90e01", multiplier: 1, feedId: 1094, price: 35.4066, accent: "hsl(175 55% 45%)", kind: "stock", logo: "/logos/PENGB.png" },
  { ticker: "UVXY", symbol: "UVXYB", name: "ProShares Ultra VIX Short-Term Futures ETF", address: "0x63ba610118fff2d6b6052cb681dcfab78cea1aa9", multiplier: 1, feedId: 1095, price: 26.5939, accent: "hsl(162 55% 45%)", kind: "etf", logo: "/logos/UVXYB.png" },
  { ticker: "KSTR", symbol: "KSTRB", name: "KraneShares STAR Market 50 ETF", address: "0x5f1668b592cdf695b0c8e643a5a0078bb94cd80c", multiplier: 1, feedId: 1100, price: 16.6225, accent: "hsl(311 55% 45%)", kind: "etf", logo: "/logos/KSTRB.png" },
  { ticker: "BOT", symbol: "BOTB", name: "RoboStrategy Inc", address: "0xd16c99b3f877b22a5dd42eef2fa77bd403306685", multiplier: 1, feedId: 1101, price: 18.2318, accent: "hsl(357 55% 45%)", kind: "stock", logo: "/logos/BOTB.png" },
  { ticker: "TMF", symbol: "TMFB", name: "Direxion Daily 20 Year Treasury Bull 3X ETF", address: "0x19568bf80e61e6272ff04403c4d5b09833cc7c54", multiplier: 1, feedId: 1103, price: 30.217, accent: "hsl(304 55% 45%)", kind: "etf", logo: "/logos/TMFB.png" },
  { ticker: "VST", symbol: "VSTB", name: "Vistra Corp", address: "0xc7fb9c23f359b7e072706eb43db8cf489aa8f87f", multiplier: 1, feedId: 1102, price: 117.3338, accent: "hsl(17 55% 45%)", kind: "stock", logo: "/logos/VSTB.png" },
  { ticker: "BRK.B", symbol: "BRKBB", name: "Berkshire Hathaway", address: "0xd42890342929f9ee362a8de900b638bc10095346", multiplier: 1, feedId: 1104, price: 580.449, accent: "hsl(161 55% 45%)", kind: "stock", logo: "/logos/BRKBB.png" },
  { ticker: "BSP", symbol: "BSPB", name: "Bending Spoons", address: "0xc895d166fe59841dc71003f80d7ef2f00f40a4be", multiplier: 1, feedId: 1126, price: 41.8847, accent: "hsl(164 55% 45%)", kind: "stock", logo: "/logos/BSPB.png" },
  { ticker: "SKDD", symbol: "SKDDB", name: "GraniteShares 2x Short SK Hynix Daily ETF", address: "0x515f386fc664980db2ab30c574ec210983232493", multiplier: 1, feedId: 1128, price: 12.3437, accent: "hsl(175 55% 45%)", kind: "etf", logo: "/logos/SKDDB.png" },
  { ticker: "SKUU", symbol: "SKUUB", name: "GraniteShares 2x Long SK Hynix Daily ETF", address: "0x97e8cfe35467d7ad6ed672d519e466200fb394d0", multiplier: 1, feedId: 1129, price: 7.7618, accent: "hsl(136 55% 45%)", kind: "etf", logo: "/logos/SKUUB.png" },
  { ticker: "GEV", symbol: "GEVB", name: "GE Vernova Inc", address: "0x5eadd95a428bc66698620c093eddd8a4b3165269", multiplier: 1, feedId: 1127, price: 694.0489, accent: "hsl(327 55% 45%)", kind: "stock", logo: "/logos/GEVB.png" },
  { ticker: "APP", symbol: "APPB", name: "Applovin Corp", address: "0x15ec59551096d5ae2df8cde08618035145828548", multiplier: 1, feedId: 1125, price: 369.6809, accent: "hsl(78 55% 45%)", kind: "stock", logo: "/logos/APPB.png" },
  { ticker: "EWZS", symbol: "EWZSB", name: "iShares MSCI Brazil Small-Cap ETF", address: "0xc5a784b9bc0d9c526a1ef582c107ab2ff1c8fe14", multiplier: 1, feedId: 1170, price: 10.286, accent: "hsl(255 55% 45%)", kind: "etf", logo: "/logos/EWZSB.png" },
  { ticker: "NU", symbol: "NUB", name: "Nu Holdings", address: "0x3cf7b2b634bac8c5e977e1576d79ea667e62f31c", multiplier: 1, feedId: 1168, price: 11.5952, accent: "hsl(186 55% 45%)", kind: "stock", logo: "/logos/NUB.png" },
  { ticker: "MELI", symbol: "MELIB", name: "MercadoLibre", address: "0xe1fc8b12eeda0b7f8ed1330477ba330d3b5afbc9", multiplier: 1, feedId: 1167, price: 1432.2104, accent: "hsl(270 55% 45%)", kind: "stock", logo: "/logos/MELIB.png" },
  { ticker: "EWT", symbol: "EWTB", name: "iShares MSCI Taiwan ETF", address: "0x24824404bb9577697d11a07a5d88341191de6578", multiplier: 1, feedId: 1164, price: 80.9962, accent: "hsl(334 55% 45%)", kind: "etf", logo: "/logos/EWTB.png" },
  { ticker: "EWJ", symbol: "EWJB", name: "iShares MSCI Japan ETF", address: "0x26e32dab9f844d7256db4195b3a43750272a51e9", multiplier: 1, feedId: 1163, price: 86.1173, accent: "hsl(337 55% 45%)", kind: "etf", logo: "/logos/EWJB.png" },
  { ticker: "IWM", symbol: "IWMB", name: "iShares Russell 2000 Index Fund", address: "0x5e0ec7c48f2da6d8db1a2c95d71c535bf8a77c41", multiplier: 1, feedId: 1166, price: 264.4705, accent: "hsl(83 55% 45%)", kind: "etf", logo: "/logos/IWMB.png" },
  { ticker: "EWZ", symbol: "EWZB", name: "iShares MSCI Brazil ETF", address: "0xb17d6ec90fd85315cd1bbcd330c3ebb07dcc822d", multiplier: 1, feedId: 1165, price: 28.9806, accent: "hsl(258 55% 45%)", kind: "etf", logo: "/logos/EWZB.png" },
  { ticker: "ANT", symbol: "ANTB", name: "Anthropic", address: "0x38dd26788cf2d901e3abf04efe3007d459d0fc53", multiplier: 1, feedId: 1169, price: 77.0482, accent: "hsl(28 55% 45%)", kind: "stock", logo: "/logos/ANTB.png" },
  { ticker: "FRHC", symbol: "FRHCB", name: "Freedom Holding Corp", address: "0x091d185e0702131a3047beb6460454f43d667e80", multiplier: 1, feedId: null, price: null, accent: "hsl(97 55% 45%)", kind: "stock", logo: "/logos/FRHCB.png" },
  { ticker: "IGV", symbol: "IGVB", name: "iShares Expanded Tech-Software Sector ETF", address: "0x3f9550a5355e11c4c4e24a82e47b53a4a5d1e17d", multiplier: 1, feedId: null, price: null, accent: "hsl(352 55% 45%)", kind: "etf", logo: "/logos/IGVB.png" },
  { ticker: "SOXX", symbol: "SOXXB", name: "iShares Semiconductor ETF", address: "0xcd1e9a6d7416674347c44e7a95b1f5954540fffd", multiplier: 1, feedId: null, price: null, accent: "hsl(69 55% 45%)", kind: "etf", logo: "/logos/SOXXB.png" },
  { ticker: "ARTY", symbol: "ARTYB", name: "iShares Future AI & Tech ETF", address: "0x4c7ae9c293641cd1530ba3ab1b14ef004193e928", multiplier: 1, feedId: null, price: null, accent: "hsl(215 55% 45%)", kind: "etf", logo: "/logos/ARTYB.png" },
  { ticker: "IBIT", symbol: "IBITB", name: "iShares Bitcoin Trust", address: "0x2480a1b8e5f68752fe880fba96e5517369a5f6a1", multiplier: 1, feedId: null, price: null, accent: "hsl(18 55% 45%)", kind: "etf", logo: "/logos/IBITB.png" },
];

/** Only stocks the vault can price (Atlas feed available). */
export const PRICED_STOCKS = STOCKS.filter((s) => s.feedId !== null);

export const stockOf = (ticker: string) => STOCKS.find((s) => s.ticker === ticker || s.symbol === ticker)!;

/** Logo path for a bStock symbol (TSLAB) or an underlying ticker (TSLA). */
export function logoFor(symbolOrTicker: string): string | null {
  const s = STOCKS.find((x) => x.symbol === symbolOrTicker || x.ticker === symbolOrTicker);
  return s ? s.logo : symbolOrTicker === "LISTA" ? "/logos/LISTA.png" : null;
}
