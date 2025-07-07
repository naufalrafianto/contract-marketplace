require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28", settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    viaIR: true
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
      gasPrice: 'auto',
      gas: 'auto',
      timeout: 60000,
      confirmations: 2
    },

    cardona: {
      url: process.env.CARDONA_RPC_URL,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 2442,
      gasPrice: 'auto',
      gas: 'auto',
      timeout: 60000,
      confirmations: 1
    }
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    gasPrice: 20,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
  etherscan: {
    apiKey: {
      polygonZkEVM: process.env.POLYGONSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY
    }
  },
  mocha: {
    timeout: 60000,
  },
};
