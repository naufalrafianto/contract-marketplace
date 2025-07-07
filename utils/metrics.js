const fs = require('fs');
const path = require('path');

class MetricsCollector {
    constructor() {
        this.metrics = [];
        this.startTime = Date.now();
    }

    async record(operation, network, gasUsed, transactionTime, success, error = null, txReceipt = null) {
        let gasPrice = null;
        let blockNumber = null;

        // Extract additional data from transaction receipt
        if (txReceipt && success) {
            try {
                blockNumber = txReceipt.blockNumber;

                // Get gas price from transaction
                if (txReceipt.gasPrice) {
                    gasPrice = txReceipt.gasPrice.toString();
                } else if (txReceipt.effectiveGasPrice) {
                    gasPrice = txReceipt.effectiveGasPrice.toString();
                }
            } catch (err) {
                console.warn(`Warning: Could not extract additional tx data: ${err.message}`);
            }
        }

        this.metrics.push({
            timestamp: Date.now(),
            operation,
            network,
            gasUsed: gasUsed || 0,
            transactionTime,
            success,
            error: error?.message || null,
            gasPrice,
            blockNumber
        });
    }

    async recordTransaction(operation, network, tx, receipt) {
        const transactionTime = Date.now() - this.startTime;
        await this.record(
            operation,
            network,
            receipt?.gasUsed?.toString(),
            transactionTime,
            receipt?.status === 1,
            null,
            receipt
        );
    }

    getStats() {
        const networkStats = {};

        this.metrics.forEach(metric => {
            if (!networkStats[metric.network]) {
                networkStats[metric.network] = {
                    totalTransactions: 0,
                    successfulTransactions: 0,
                    failedTransactions: 0,
                    totalGasUsed: 0,
                    totalTime: 0,
                    avgGasPrice: 0,
                    operations: {}
                };
            }

            const stats = networkStats[metric.network];
            stats.totalTransactions++;

            if (metric.success) {
                stats.successfulTransactions++;
                stats.totalGasUsed += parseInt(metric.gasUsed || 0);

                // Calculate average gas price
                if (metric.gasPrice && metric.gasPrice !== 'null') {
                    const gasPriceNum = parseInt(metric.gasPrice);
                    stats.avgGasPrice = ((stats.avgGasPrice * (stats.successfulTransactions - 1)) + gasPriceNum) / stats.successfulTransactions;
                }
            } else {
                stats.failedTransactions++;
            }

            stats.totalTime += metric.transactionTime;

            if (!stats.operations[metric.operation]) {
                stats.operations[metric.operation] = {
                    count: 0,
                    totalGas: 0,
                    totalTime: 0,
                    successCount: 0,
                    failCount: 0
                };
            }

            const opStats = stats.operations[metric.operation];
            opStats.count++;
            opStats.totalGas += parseInt(metric.gasUsed || 0);
            opStats.totalTime += metric.transactionTime;

            if (metric.success) {
                opStats.successCount++;
            } else {
                opStats.failCount++;
            }
        });

        // Calculate derived metrics
        Object.keys(networkStats).forEach(network => {
            const stats = networkStats[network];
            stats.successRate = (stats.successfulTransactions / stats.totalTransactions * 100).toFixed(2);
            stats.avgGasPerTx = Math.round(stats.totalGasUsed / stats.successfulTransactions) || 0;
            stats.avgResponseTime = Math.round(stats.totalTime / stats.totalTransactions) || 0;
            stats.estimatedTPS = stats.totalTransactions > 0 ? (stats.totalTransactions / (stats.totalTime / 1000)).toFixed(2) : 0;
        });

        return networkStats;
    }

    exportToFile(filename = 'test-results.json') {
        const stats = this.getStats();
        const report = {
            testSummary: {
                totalMetrics: this.metrics.length,
                testDuration: Date.now() - this.startTime,
                networks: Object.keys(stats)
            },
            networkComparison: stats,
            detailedMetrics: this.calculateDetailedMetrics(stats),
            rawMetrics: this.metrics
        };

        const reportsDir = path.join(__dirname, '..', 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(reportsDir, filename),
            JSON.stringify(report, null, 2)
        );

        return report;
    }

    calculateDetailedMetrics(stats) {
        const detailed = {};

        Object.keys(stats).forEach(network => {
            const networkStats = stats[network];
            detailed[network] = {
                gasEfficiency: {
                    totalGasUsed: networkStats.totalGasUsed,
                    avgGasPerTx: networkStats.avgGasPerTx,
                    avgGasPrice: Math.round(networkStats.avgGasPrice),
                    gasPriceInGwei: (networkStats.avgGasPrice / 1e9).toFixed(4)
                },
                performance: {
                    avgResponseTime: networkStats.avgResponseTime,
                    estimatedTPS: parseFloat(networkStats.estimatedTPS),
                    successRate: parseFloat(networkStats.successRate)
                },
                reliability: {
                    totalAttempts: networkStats.totalTransactions,
                    successful: networkStats.successfulTransactions,
                    failed: networkStats.failedTransactions,
                    reliabilityScore: parseFloat(networkStats.successRate)
                }
            };
        });

        return detailed;
    }
}

module.exports = MetricsCollector;