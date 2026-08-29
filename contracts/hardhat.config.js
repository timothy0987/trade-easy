require('dotenv').config();
require("@nomicfoundation/hardhat-toolbox");

const { PRIVATE_KEY, HORIZEN_TESTNET_RPC_URL = "https://horizen-testnet.rpc.caldera.xyz/http" } = process.env;
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true, // PrivateTradingVault.executeTrade would otherwise hit "stack too deep"
      evmVersion: "cancun",
    },
  },
  networks: {
    // Horizen Testnet — runs on Base Sepolia. Gas token: ETH.
    // Params per https://horizen-2-docs.horizen.io/horizen-chain/network/testnet
    horizenTestnet: {
      url: HORIZEN_TESTNET_RPC_URL,
      chainId: 2651420,
      accounts,
      timeout: 120000, // Caldera RPC can be slow; don't abort on a slow response
    },
  },
  etherscan: {
    apiKey: { horizenTestnet: "blockscout" },
    customChains: [
      {
        network: "horizenTestnet",
        chainId: 2651420,
        urls: {
          apiURL: "https://explorer-testnet.horizen.io/api",
          browserURL: "https://explorer-testnet.horizen.io",
        },
      },
    ],
  },
  sourcify: { enabled: true },
};
