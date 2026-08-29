require('dotenv').config();
require("@nomicfoundation/hardhat-toolbox");

const { PRIVATE_KEY, HORIZEN_TESTNET_RPC_URL = "https://horizen-rpc-testnet.appchain.base.org" } = process.env;
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    // Horizen — EVM-native L3 on Base. Gas token: ETH.
    // Verify chainId / RPC against https://chainlist.org/chain/845320009 before mainnet.
    horizenTestnet: {
      url: HORIZEN_TESTNET_RPC_URL,
      chainId: 845320009,
      accounts,
    },
  },
  etherscan: {
    apiKey: { horizenTestnet: "blockscout" },
    customChains: [
      {
        network: "horizenTestnet",
        chainId: 845320009,
        urls: {
          apiURL: "https://horizen-explorer-testnet.appchain.base.org/api",
          browserURL: "https://horizen-explorer-testnet.appchain.base.org",
        },
      },
    ],
  },
  sourcify: { enabled: true },
};
