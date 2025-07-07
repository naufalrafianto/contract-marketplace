const { expect } = require('chai');
const { ethers } = require('hardhat');
const NetworkMonitor = require('../utils/networks');
const MetricsCollector = require('../utils/metrics');
require('dotenv').config()

describe('Network Performance Test', function () {
    let sepoliaMonitor, cardonaMonitor;

    // Increase timeout for network tests
    this.timeout(360000); // 6 minutes

    before(async function () {
        console.log('Initializing network monitors...');

        // Multiple RPC endpoints for fallback
        const sepoliaRpcs =
            process.env.SEPOLIA_RPC_URL

        const cardonaRpcs = process.env.CARDONA_RPC_URL

        try {
            sepoliaMonitor = new NetworkMonitor(sepoliaRpcs, 'sepolia');
            console.log('✅ Sepolia monitor initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Sepolia monitor:', error.message);
        }

        try {
            cardonaMonitor = new NetworkMonitor(cardonaRpcs, 'cardona');
            console.log('✅ Cardona monitor initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Cardona monitor:', error.message);
        }
    });

    describe('Short Network Monitoring', function () {
        it('should monitor both networks for 2 minutes', async function () {
            const monitoringDuration = 120000; // 2 minutes

            console.log('Starting 2-minute network monitoring...');

            const promises = [];

            if (sepoliaMonitor) {
                promises.push(sepoliaMonitor.startMonitoring(monitoringDuration));
            }

            if (cardonaMonitor) {
                promises.push(cardonaMonitor.startMonitoring(monitoringDuration));
            }

            if (promises.length === 0) {
                console.log('No monitors available, skipping test');
                return;
            }

            const results = await Promise.allSettled(promises);

            console.log('\n=== NETWORK PERFORMANCE RESULTS ===');

            results.forEach((result, index) => {
                const networkName = index === 0 ? 'Sepolia' : 'Cardona';

                if (result.status === 'fulfilled') {
                    const report = result.value;
                    console.log(`\n${networkName} Network:`);

                    if (report.error) {
                        console.log(`❌ Error: ${report.error}`);
                    } else {
                        const avgGasPrice = parseFloat(report.averageGasPrice);
                        console.log(`✅ Data Points: ${report.dataPoints}`);
                        console.log(`Average Block Time: ${report.averageBlockTime?.toFixed(2)}s`);
                        console.log(`Min Block Time: ${report.minBlockTime?.toFixed(2)}s`);
                        console.log(`Max Block Time: ${report.maxBlockTime?.toFixed(2)}s`);
                        console.log(`Average Transactions/Block: ${report.averageTransactionsPerBlock?.toFixed(2)}`);
                        console.log(`Average Gas Price: ${isNaN(avgGasPrice) ? 'N/A' : avgGasPrice.toFixed(4)} gwei`);
                        console.log(`Reliability: ${report.reliability}%`);
                        console.log(`Connection Errors: ${report.connectionErrors}`);
                    }
                } else {
                    console.log(`\n${networkName} Network:`);
                    console.log(`❌ Monitoring failed: ${result.reason?.message}`);
                }
            });

            // Save reports
            const fs = require('fs');
            const path = require('path');

            const reportsDir = path.join(__dirname, '..', 'reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            const finalReports = results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message });

            fs.writeFileSync(
                path.join(reportsDir, 'network-performance.json'),
                JSON.stringify({
                    sepolia: finalReports[0] || {},
                    cardona: finalReports[1] || {},
                    testDuration: monitoringDuration,
                    timestamp: new Date().toISOString()
                }, null, 2)
            );
        });
    });
});
