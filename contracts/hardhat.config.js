require('dotenv').config();
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hederaTestnet: {
      url: "https://testnet.hashio.io/api",
      chainId: 296,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 2000000000000 // 2000 Gwei
    },
    x1_testnet: {
      url: 'https://x1-testnet.xen.network',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 204005,
    }
  },
  sourcify: {
    enabled: true
  }
};
