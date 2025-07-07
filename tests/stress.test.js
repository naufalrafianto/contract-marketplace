const { expect } = require('chai');
const { ethers } = require('hardhat');
const MetricsCollector = require('../utils/metrics');
const ContractHelper = require('../utils/helpers');

describe('Stress Test - Sepolia vs Cardona zkEVM', function () {
    let metricsCollector;
    let contracts = {};
    let owner, users;

    // Increase timeout for stress tests
    this.timeout(600000); // 10 minutes

    before(async function () {
        console.log('Setting up stress test environment...');

        metricsCollector = new MetricsCollector();
        [owner, ...users] = await ethers.getSigners();

        // Deploy contracts (simulated for local testing)
        const contractFactory = await ethers.getContractFactory('TicketMarketplace');

        contracts.sepolia = await contractFactory.deploy();
        await contracts.sepolia.waitForDeployment();

        contracts.cardona = await contractFactory.deploy();
        await contracts.cardona.waitForDeployment();

        console.log('Environment setup completed');
    });

    describe('Controlled Event Creation Stress Test', function () {
        it('should handle 50 sequential event creations with proper metrics', async function () {
            const eventCount = 50;
            console.log(`Creating ${eventCount} events on both networks...`);

            // Test both networks
            for (const networkName of ['sepolia', 'cardona']) {
                console.log(`\nTesting ${networkName}...`);
                const contract = contracts[networkName];

                for (let i = 0; i < eventCount; i++) {
                    const startTime = Date.now();

                    try {
                        const tx = await contract.createEvent(
                            `Stress Event ${i}`,
                            `Description for event ${i}`,
                            ethers.parseEther('0.01'),
                            100,
                            Math.floor(new Date('2025-12-31').getTime() / 1000)
                        );

                        const receipt = await tx.wait();

                        await metricsCollector.record(
                            'createEvent',
                            networkName,
                            receipt.gasUsed.toString(),
                            Date.now() - startTime,
                            receipt.status === 1,
                            null,
                            receipt
                        );

                        if (i % 10 === 0) {
                            console.log(`${networkName}: Created ${i + 1}/${eventCount} events`);
                        }

                    } catch (error) {
                        await metricsCollector.record(
                            'createEvent',
                            networkName,
                            0,
                            Date.now() - startTime,
                            false,
                            error
                        );

                        console.error(`${networkName} event ${i} failed:`, error.message);
                    }

                    // Small delay to prevent overwhelming the network
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            console.log('Event creation stress test completed');
        });
    });

    describe('Batch Ticket Purchase Test', function () {
        let eventId = 1;

        it('should handle 100 ticket purchases in batches', async function () {
            const totalTickets = 100;
            const batchSize = 10;
            const batches = Math.ceil(totalTickets / batchSize);

            console.log(`Purchasing ${totalTickets} tickets in ${batches} batches...`);

            for (const networkName of ['sepolia', 'cardona']) {
                console.log(`\nTesting ${networkName}...`);
                const contract = contracts[networkName];

                for (let batch = 0; batch < batches; batch++) {
                    const batchPromises = [];
                    const startIndex = batch * batchSize;
                    const endIndex = Math.min(startIndex + batchSize, totalTickets);

                    for (let i = startIndex; i < endIndex; i++) {
                        const userIndex = i % Math.min(users.length, 10); // Limit concurrent users
                        const user = users[userIndex];

                        const promise = (async () => {
                            const startTime = Date.now();
                            try {
                                const tx = await contract.connect(user).purchaseTicket(
                                    eventId,
                                    `https://api.tickets.com/metadata/${i}`,
                                    { value: ethers.parseEther('0.01') }
                                );
                                const receipt = await tx.wait();

                                await metricsCollector.record(
                                    'purchaseTicket',
                                    networkName,
                                    receipt.gasUsed.toString(),
                                    Date.now() - startTime,
                                    receipt.status === 1,
                                    null,
                                    receipt
                                );
                            } catch (error) {
                                await metricsCollector.record(
                                    'purchaseTicket',
                                    networkName,
                                    0,
                                    Date.now() - startTime,
                                    false,
                                    error
                                );
                            }
                        })();

                        batchPromises.push(promise);
                    }

                    await Promise.allSettled(batchPromises);
                    console.log(`${networkName}: Completed batch ${batch + 1}/${batches}`);

                    // Delay between batches
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log('Ticket purchase stress test completed');
        });
    });

    after(async function () {
        const report = metricsCollector.exportToFile('stress-test-results.json');

        console.log('\n=== STRESS TEST RESULTS ===');
        Object.keys(report.networkComparison).forEach(network => {
            const stats = report.networkComparison[network];
            console.log(`\n${network.toUpperCase()} Results:`);
            console.log(`Success Rate: ${stats.successRate}%`);
            console.log(`Average Gas Used: ${stats.avgGasPerTx}`);
            console.log(`Average Response Time: ${stats.avgResponseTime}ms`);
            console.log(`Estimated TPS: ${stats.estimatedTPS}`);

            if (report.detailedMetrics[network]) {
                const detailed = report.detailedMetrics[network];
                console.log(`Gas Price (Gwei): ${detailed.gasEfficiency.gasPriceInGwei}`);
                console.log(`Reliability Score: ${detailed.reliability.reliabilityScore}%`);
            }
        });
    });
});