// Shared helpers for the Grailio OpenFour scripts. ABIs are the public OpenFour Core / Registry / Tools surface.
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const REGISTRY_ABI = [
  "function owner() view returns (address)",
  "function getPreset(uint256 presetId) view returns (tuple(uint256 id, string name, string description, string version, bool active, bool createEnabled, address validator, bytes32 tokenModuleId, bytes32 vaultModuleId, bytes32 curveModuleId, bytes32 tradeModuleId, bytes32 migrateModuleId, bytes32 tokenImplId, bytes32 customDataId, address author))",
  "function upsertModule(bytes32 moduleKey, address implementation, uint8 kind, tuple(bytes32 moduleId, string version, string name, string description, address author, uint16 feeShareBps) metadata, bool active)",
  "function upsertPreset(tuple(uint256 id, string name, string description, string version, bool active, bool createEnabled, address validator, bytes32 tokenModuleId, bytes32 vaultModuleId, bytes32 curveModuleId, bytes32 tradeModuleId, bytes32 migrateModuleId, bytes32 tokenImplId, bytes32 customDataId, address author) preset)",
];
const CORE_ABI = [
  "function createToken(bytes createArgs, bytes signature) payable returns (address)",
  "function buy(address token, uint256 amount, uint256 maxQuotePayAmount, uint256 options, bytes proof) payable",
  "function migrate(address token)",
  "function tokens(address) view returns (uint32 version,address creator,uint256 presetId,address token,string name,string symbol,uint256 maxSupply,uint256 saleAmount,uint256 raiseAmount,address quoteAsset,address vault,address curveModule,address tradeModule,address migrateModule,address tokenModule,address customData,uint256 createBlock,bool exists,bool paused,bool antiSniperEnabled)",
  "function signer() view returns (address)",
  "event TokenCreated(uint256 requestId, uint256 indexed presetId, address indexed creator, address indexed token, string name, string symbol, uint256 maxSupply, uint256 saleAmount, uint256 raiseAmount, uint256 initialPrice, address quoteAsset, address vault, address curveModule, address tradeModule, address migrateModule, address customData, address tokenModule, string tokenMetaUri, uint256 flags, bytes encodedTags)",
];
const TOOLS_ABI = [
  "function estimateBuy(address token,address trader,uint256 amount,uint256 options,bytes proof) returns (tuple(uint256 curveQuote, uint256 totalFee, uint256 userPays, uint256 userReceives, uint256 tokenAmount, uint256 executionPrice))",
];
const VAULT_ABI = [
  "function remainingForSale() view returns (uint256)",
  "function totalRaised() view returns (uint256)",
  "function phase() view returns (uint8)",
];
const FEE_ROUTER_ABI = [
  "function presetFeeConfig(uint256 presetId) view returns (uint16 protocolFeeBps, uint16 developerFeePoolBps, uint16 maxProtocolDevFeeBps, uint16 maxTaxBps, uint8 maxTaxTiers, bool active, uint256 partnerProtocolShareBps)",
  "function setPresetFeeConfig(uint256 presetId, tuple(uint16 protocolFeeBps, uint16 developerFeePoolBps, uint16 maxProtocolDevFeeBps, uint16 maxTaxBps, uint8 maxTaxTiers, bool active, uint256 partnerProtocolShareBps) cfg)",
];

const KIND = { token: 0, vault: 1, curve: 2, trade: 3, migrate: 4, customData: 5 };
const key = (tag) => ethers.keccak256(ethers.toUtf8Bytes(tag));
const outDir = path.join(__dirname, "..", "out");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2) + "\n");
}

/** Our OpenFour proxy set, written by OpenFour's fork-deploy (`out/fork-deployment.json`). */
function loadFork() {
  const file = path.resolve(process.env.FORK_JSON || path.join(outDir, "fork.json"));
  if (!fs.existsSync(file)) throw new Error(`No fork file at ${file}. Run OpenFour's fork-deploy and copy its out/fork-deployment.json there.`);
  return readJson(file);
}

async function connect() {
  const net = await ethers.provider.getNetwork();
  if ([56n, 4663n].includes(net.chainId)) throw new Error("Refusing to run on a mainnet");
  const [signer, ...others] = await ethers.getSigners();
  const fork = loadFork();
  const registry = new ethers.Contract(fork.addresses.registry, REGISTRY_ABI, signer);
  const core = new ethers.Contract(fork.addresses.core, CORE_ABI, signer);
  const tools = new ethers.Contract(fork.addresses.tools, TOOLS_ABI, signer);
  if ((await registry.owner()).toLowerCase() !== signer.address.toLowerCase()) throw new Error("Signer does not own this Registry");
  if ((await core.signer()).toLowerCase() !== signer.address.toLowerCase()) throw new Error("Signer is not Core.signer");
  return { net, signer, others, fork, registry, core, tools };
}

/** The create signature OpenFour Core checks: personal_sign over keccak(packed(...)). */
async function signCreate(signer, chainId, createArgs) {
  const digest = ethers.keccak256(
    ethers.solidityPacked(["string", "uint256", "address", "bytes32"], ["createOpenFourToken", chainId, signer.address, ethers.keccak256(createArgs)]),
  );
  return signer.signMessage(ethers.getBytes(digest));
}

module.exports = { REGISTRY_ABI, CORE_ABI, TOOLS_ABI, VAULT_ABI, FEE_ROUTER_ABI, KIND, key, outDir, readJson, writeJson, loadFork, connect, signCreate };
