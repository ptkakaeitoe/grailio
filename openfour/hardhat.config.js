require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Public RPC only. Deploys read DEPLOYER_PRIVATE_KEY from .env (OpenFour's toolkit convention): use a fresh wallet
// that only ever holds testnet BNB, and never commit .env.
const BSC_TESTNET_RPC = process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet.publicnode.com";
const FORK = process.env.FORK === "1";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // OpenFour requires exactly this compiler setup for module bytecode.
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true } },
  networks: {
    hardhat: FORK
      ? { chainId: 97, forking: { url: BSC_TESTNET_RPC }, initialBaseFeePerGas: 0 }
      : { chainId: 31337, initialBaseFeePerGas: 0 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 97 },
    bsctestnet: {
      url: BSC_TESTNET_RPC,
      chainId: 97,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  mocha: { timeout: 600000 },
};
