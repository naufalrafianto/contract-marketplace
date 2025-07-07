const { expect } = require('chai');
const { ethers } = require('hardhat');
const MetricsCollector = require('../utils/metrics');

describe('Load Test', function () {
    let metricsCollector;
    let contracts = {};
    let eventId;

    this.timeout(900000); // 15 minutes

    before(async function () {
        console.log('Setting up load test environment...');

        metricsCollector = new MetricsCollector();
        const contractFactory = await ethers.getContractFactory('TicketMarketplace');

        contracts.sepolia = await contractFactory.deploy();
        await contracts.sepolia.waitForDeployment();

        contracts.cardona = await contractFactory.deploy();
        await contracts.cardona.waitForDeployment();

        // Create event on Sepolia (shared across tests)
        const tx = await contracts.sepolia.createEvent(
            'Load Test Event',
            'Event for load testing',
            ethers.parseEther('0.01'),
            10000,
            Math.floor(new Date('2025-12-31').getTime() / 1000)
        );
        await tx.wait();
        eventId = 1;
    });

    describe('Progressive Load Testing', function () {
        const loadLevels = [5, 10, 20];

        loadLevels.forEach(userCount => {
            it(`should handle ${userCount} concurrent users`, async function () {
                console.log(`\nTesting with ${userCount} concurrent users...`);

                const [owner, ...users] = await ethers.getSigners();
                const availableUsers = users.slice(0, Math.min(userCount, users.length));

                for (const networkName of ['sepolia', 'cardona']) {
                    console.log(`Testing ${networkName}...`);
                    const contract = contracts[networkName];
                    const promises = [];

                    for (let i = 0; i < userCount; i++) {
                        const user = availableUsers[i % availableUsers.length];

                        const promise = (async () => {
                            const startTime = Date.now();
                            const operations = ['purchaseTicket', 'getEventInfo'];
                            const operation = operations[Math.floor(Math.random() * operations.length)];

                            try {
                                let receipt = { gasUsed: 0, status: 1 };

                                if (operation === 'purchaseTicket') {
                                    const tx = await contract.connect(user).purchaseTicket(
                                        eventId,
                                        `https://api.tickets.com/metadata/${i}`,
                                        { value: ethers.parseEther('0.01') }
                                    );
                                    receipt = await tx.wait();
                                } else {
                                    await contract.getEventInfo(eventId);
                                }

                                await metricsCollector.record(
                                    operation,
                                    networkName,
                                    receipt.gasUsed?.toString() || '0',
                                    Date.now() - startTime,
                                    receipt.status === 1,
                                    null,
                                    receipt
                                );
                            } catch (error) {
                                await metricsCollector.record(
                                    operation,
                                    networkName,
                                    '0',
                                    Date.now() - startTime,
                                    false,
                                    error
                                );
                            }
                        })();

                        promises.push(promise);
                    }

                    await Promise.allSettled(promises);
                    console.log(`${networkName} completed ${userCount} user test`);
                }
            });
        });
    });

    describe('Sustained Load Test', function () {
        it('should handle sustained load for 5 minutes', async function () {
            console.log('\nStarting 5-minute sustained load test...');

            const testDuration = 300000; // 5 minutes
            const startTime = Date.now();
            const [owner, ...users] = await ethers.getSigners();
            const batchSize = 5;
            const batchInterval = 2000;

            while (Date.now() - startTime < testDuration) {
                const batchPromises = [];

                for (let i = 0; i < batchSize; i++) {
                    const networkName = Math.random() > 0.5 ? 'sepolia' : 'cardona';
                    const contract = contracts[networkName];
                    const user = users[i % Math.min(users.length, 5)];

                    const promise = (async () => {
                        const opStartTime = Date.now();
                        try {
                            if (Math.random() > 0.8) {
                                const tx = await contract.connect(user).purchaseTicket(
                                    eventId,
                                    `https://api.tickets.com/metadata/${Date.now()}`,
                                    { value: ethers.parseEther('0.01') }
                                );
                                const receipt = await tx.wait();

                                await metricsCollector.record(
                                    'purchaseTicket',
                                    networkName,
                                    receipt.gasUsed.toString(),
                                    Date.now() - opStartTime,
                                    receipt.status === 1,
                                    null,
                                    receipt
                                );
                            } else {
                                await contract.getEventInfo(eventId);

                                await metricsCollector.record(
                                    'getEventInfo',
                                    networkName,
                                    '0',
                                    Date.now() - opStartTime,
                                    true
                                );
                            }
                        } catch (error) {
                            await metricsCollector.record(
                                'mixed_operation',
                                networkName,
                                '0',
                                Date.now() - opStartTime,
                                false,
                                error
                            );
                        }
                    })();

                    batchPromises.push(promise);
                }

                await Promise.allSettled(batchPromises);

                const elapsed = Date.now() - startTime;
                const progress = ((elapsed / testDuration) * 100).toFixed(1);
                if (elapsed % 30000 < batchInterval) {
                    console.log(`Progress: ${progress}% (${Math.round(elapsed / 1000)}s)`);
                }

                await new Promise(resolve => setTimeout(resolve, batchInterval));
            }

            console.log('Sustained load test completed');
        });
    });

    after(async function () {
        const report = metricsCollector.exportToFile('load-test-results.json');

        console.log('\n=== OPTIMIZED LOAD TEST SUMMARY ===');

        Object.keys(report.networkComparison).forEach(network => {
            const stats = report.networkComparison[network];
            console.log(`\n${network.toUpperCase()} Network Results:`);
            console.log(`Total Transactions: ${stats.totalTransactions}`);
            console.log(`Success Rate: ${stats.successRate}%`);
            console.log(`Average Gas Used: ${stats.avgGasPerTx}`);
            console.log(`Average Response Time: ${stats.avgResponseTime}ms`);
            console.log(`Estimated TPS: ${stats.estimatedTPS}`);

            console.log('Operations Breakdown:');
            Object.keys(stats.operations).forEach(op => {
                const opStats = stats.operations[op];
                const opSuccessRate = ((opStats.successCount / opStats.count) * 100).toFixed(2);
                const avgGas = opStats.count ? Math.round(opStats.totalGas / opStats.count) : 0;
                console.log(`  ${op}: ${opStats.count} ops, ${opSuccessRate}% success, avg gas: ${avgGas}`);
            });
        });
    });
});
