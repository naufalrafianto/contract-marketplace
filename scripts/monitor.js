const WebSocket = require('ws');
const fs = require('fs');
require('dotenv').config()
const { ethers } = require('ethers');

class NetworkMonitor {
  constructor(rpcUrls, networkName) {
    this.networkName = networkName;
    this.providers = [];
    this.currentProviderIndex = 0;
    this.monitoring = false;
    this.stats = {
      blockTimes: [],
      gasUsages: [],
      transactionCounts: [],
      gasPrice: 0,
      connectionErrors: 0
    };

    // Setup multiple providers for fallback
    if (Array.isArray(rpcUrls)) {
      rpcUrls.forEach(url => {
        try {
          this.providers.push(new ethers.JsonRpcProvider(url));
        } catch (error) {
          console.warn(`Failed to create provider for ${url}: ${error.message}`);
        }
      });
    } else {
      try {
        this.providers.push(new ethers.JsonRpcProvider(rpcUrls));
      } catch (error) {
        console.error(`Failed to create provider for ${rpcUrls}: ${error.message}`);
      }
    }

    if (this.providers.length === 0) {
      throw new Error(`No valid providers could be created for ${networkName}`);
    }
  }

  async getCurrentProvider() {
    const provider = this.providers[this.currentProviderIndex];

    try {
      // Test the connection
      await provider.getBlockNumber();
      return provider;
    } catch (error) {
      console.warn(`Provider ${this.currentProviderIndex} failed: ${error.message}`);
      this.stats.connectionErrors++;

      // Try next provider
      this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;

      if (this.currentProviderIndex === 0) {
        // We've tried all providers
        throw new Error(`All providers failed for ${this.networkName}`);
      }

      return this.getCurrentProvider();
    }
  }

  async startMonitoring(duration = 60000) {
    this.monitoring = true;
    const startTime = Date.now();

    console.log(`Starting network monitoring for ${this.networkName} (${duration / 1000}s)...`);

    try {
      const provider = await this.getCurrentProvider();
      let lastBlock = await provider.getBlockNumber();

      while (this.monitoring && (Date.now() - startTime < duration)) {
        try {
          const currentProvider = await this.getCurrentProvider();
          const currentBlock = await currentProvider.getBlockNumber();

          if (currentBlock > lastBlock) {
            const block = await currentProvider.getBlock(currentBlock, false);

            if (block && currentBlock > 1) {
              const prevBlock = await currentProvider.getBlock(currentBlock - 1, false);

              if (prevBlock) {
                const blockTime = block.timestamp - prevBlock.timestamp;
                this.stats.blockTimes.push(blockTime);
                this.stats.transactionCounts.push(block.transactions.length);

                // Get gas price safely
                try {
                  const feeData = await currentProvider.getFeeData();
                  if (feeData.gasPrice) {
                    this.stats.gasPrice = Number(ethers.formatUnits(feeData.gasPrice, 'gwei'));
                  }
                } catch (gasPriceError) {
                  console.warn(`Could not get gas price: ${gasPriceError.message}`);
                }
              }
            }

            lastBlock = currentBlock;
          }

          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second intervals

        } catch (error) {
          console.error(`Monitoring error for ${this.networkName}:`, error.message);
          this.stats.connectionErrors++;
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer on error
        }
      }

    } catch (error) {
      console.error(`Failed to start monitoring ${this.networkName}:`, error.message);
      return this.getErrorReport(error);
    }

    console.log(`Network monitoring completed for ${this.networkName}`);
    return this.getMonitoringReport();
  }

  stopMonitoring() {
    this.monitoring = false;
  }

  getMonitoringReport() {
    const blockTimes = this.stats.blockTimes;
    const transactionCounts = this.stats.transactionCounts;

    if (blockTimes.length === 0) {
      return this.getErrorReport(new Error('No data collected'));
    }

    return {
      network: this.networkName,
      dataPoints: blockTimes.length,
      averageBlockTime: blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length,
      minBlockTime: Math.min(...blockTimes),
      maxBlockTime: Math.max(...blockTimes),
      blockTimeStdDev: this.calculateStdDev(blockTimes),
      averageTransactionsPerBlock: transactionCounts.reduce((a, b) => a + b, 0) / transactionCounts.length,
      totalBlocks: blockTimes.length,
      averageGasPrice: this.stats.gasPrice,
      connectionErrors: this.stats.connectionErrors,
      reliability: ((blockTimes.length / (blockTimes.length + this.stats.connectionErrors)) * 100).toFixed(2)
    };
  }

  getErrorReport(error) {
    return {
      network: this.networkName,
      error: error.message,
      dataPoints: 0,
      averageBlockTime: 0,
      minBlockTime: 0,
      maxBlockTime: 0,
      averageTransactionsPerBlock: 0,
      totalBlocks: 0,
      averageGasPrice: 0,
      connectionErrors: this.stats.connectionErrors,
      reliability: '0.00'
    };
  }

  calculateStdDev(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }
}

module.exports = NetworkMonitor;