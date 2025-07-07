const { ethers } = require('ethers');

class NetworkMonitor {
    constructor(rpcUrl, networkName) {

        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.networkName = networkName;
        this.monitoring = false;
        this.stats = {
            blockTimes: [],
            gasUsages: [],
            transactionCounts: [],
            averageGasPrice: 0,

        };
        this.stats.connectionErrors = 0;
        this.stats.totalAttempts = 0;
    }

    async startMonitoring(duration = 60000) {
        this.monitoring = true;
        const startTime = Date.now();
        let lastBlock = await this.provider.getBlockNumber();

        console.log(`Starting network monitoring for ${this.networkName}...`);

        while (this.monitoring && (Date.now() - startTime < duration)) {
            this.stats.totalAttempts++;

            try {
                const currentBlock = await this.provider.getBlockNumber();

                if (currentBlock > lastBlock) {
                    const block = await this.provider.getBlock(currentBlock);
                    const prevBlock = await this.provider.getBlock(currentBlock - 1);

                    if (block && prevBlock) {
                        const blockTime = block.timestamp - prevBlock.timestamp;
                        this.stats.blockTimes.push(blockTime);
                        this.stats.transactionCounts.push(block.transactions.length);

                        const gasPrice = await this.provider.getGasPrice?.(); // optional chaining to avoid crash
                        if (gasPrice) {
                            this.stats.averageGasPrice = ethers.formatUnits(gasPrice, 'gwei');
                        }
                    }

                    lastBlock = currentBlock;
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                this.stats.connectionErrors++;
                console.error(`Monitoring error for ${this.networkName}:`, error.message);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
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

        return {
            network: this.networkName,
            averageBlockTime: blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length || 0,
            minBlockTime: Math.min(...blockTimes) || 0,
            maxBlockTime: Math.max(...blockTimes) || 0,
            averageTransactionsPerBlock: transactionCounts.reduce((a, b) => a + b, 0) / transactionCounts.length || 0,
            totalBlocks: blockTimes.length,
            averageGasPrice: this.stats.averageGasPrice,
            connectionErrors: this.stats.connectionErrors,
            reliability: ((1 - this.stats.connectionErrors / this.stats.totalAttempts) * 100).toFixed(2)
        };
    }
}

module.exports = NetworkMonitor;