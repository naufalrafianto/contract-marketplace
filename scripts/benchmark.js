const fs = require('fs');
const path = require('path');

class BenchmarkComparison {
    constructor() {
        this.reportsDir = path.join(__dirname, '..', 'reports');
    }

    async generateComparison() {
        console.log("📊 Generating benchmark comparison...");

        // Load all test results
        const results = this.loadTestResults();

        // Generate comparison metrics
        const comparison = this.calculateComparisons(results);

        // Generate visual comparison
        const visualReport = this.generateVisualComparison(comparison);

        // Save comprehensive report
        const reportPath = path.join(this.reportsDir, 'benchmark-comparison.json');
        fs.writeFileSync(reportPath, JSON.stringify({
            comparison,
            timestamp: new Date().toISOString(),
            rawResults: results
        }, null, 2));

        // Generate markdown report
        const markdownReport = this.generateMarkdownReport(comparison);
        const mdPath = path.join(this.reportsDir, 'COMPARISON_REPORT.md');
        fs.writeFileSync(mdPath, markdownReport);

        console.log(`📋 Comparison reports generated:`);
        console.log(`JSON: ${reportPath}`);
        console.log(`Markdown: ${mdPath}`);

        return comparison;
    }

    loadTestResults() {
        const results = {};
        const reportFiles = [
            'stress-test-results.json',
            'load-test-results.json',
            'network-performance.json'
        ];

        reportFiles.forEach(filename => {
            const filePath = path.join(this.reportsDir, filename);
            if (fs.existsSync(filePath)) {
                results[filename.replace('.json', '')] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        });

        return results;
    }

    calculateComparisons(results) {
        const comparison = {
            gasEfficiency: {},
            transactionSpeed: {},
            throughput: {},
            reliability: {},
            costAnalysis: {}
        };

        // Gas Efficiency Comparison
        if (results['stress-test-results']) {
            const stressData = results['stress-test-results'].networkComparison;

            Object.keys(stressData).forEach(network => {
                const data = stressData[network];
                comparison.gasEfficiency[network] = {
                    averageGasPerTransaction: Math.round(data.totalGasUsed / data.successfulTransactions) || 0,
                    totalGasUsed: data.totalGasUsed,
                    gasEfficiencyScore: data.totalGasUsed > 0 ? Math.round(1000000 / (data.totalGasUsed / data.successfulTransactions)) : 0
                };
            });
        }

        // Transaction Speed Comparison
        if (results['load-test-results']) {
            const loadData = results['load-test-results'].networkComparison;

            Object.keys(loadData).forEach(network => {
                const data = loadData[network];
                comparison.transactionSpeed[network] = {
                    averageResponseTime: Math.round(data.totalTime / data.totalTransactions) || 0,
                    transactionsPerSecond: data.totalTransactions > 0 ? (data.totalTransactions / (data.totalTime / 1000)).toFixed(2) : 0
                };
            });
        }

        // Reliability Comparison
        Object.keys(results).forEach(testType => {
            const testData = results[testType];
            if (testData.networkComparison) {
                Object.keys(testData.networkComparison).forEach(network => {
                    if (!comparison.reliability[network]) {
                        comparison.reliability[network] = { tests: [], overallScore: 0 };
                    }

                    const networkData = testData.networkComparison[network];
                    const successRate = (networkData.successfulTransactions / networkData.totalTransactions) * 100;

                    comparison.reliability[network].tests.push({
                        testType,
                        successRate: successRate.toFixed(2)
                    });
                });
            }
        });

        // Calculate overall reliability scores
        Object.keys(comparison.reliability).forEach(network => {
            const tests = comparison.reliability[network].tests;
            const avgSuccessRate = tests.reduce((sum, test) => sum + parseFloat(test.successRate), 0) / tests.length;
            comparison.reliability[network].overallScore = avgSuccessRate.toFixed(2);
        });

        return comparison;
    }
    getWinner(comparisonData, metric, higherIsBetter = true) {
        const networks = Object.keys(comparisonData);
        if (networks.length < 2) return 'N/A';

        let winner = networks[0];
        let bestValue = comparisonData[networks[0]][metric];

        networks.forEach(network => {
            const value = comparisonData[network][metric];
            if (higherIsBetter ? value > bestValue : value < bestValue) {
                bestValue = value;
                winner = network;
            }
        });

        return winner.charAt(0).toUpperCase() + winner.slice(1);
    }
}