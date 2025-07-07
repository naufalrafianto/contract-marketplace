const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
    constructor() {
        this.results = {
            startTime: new Date().toISOString(),
            tests: {},
            summary: {}
        };
        this.reportsDir = path.join(__dirname, '..', 'reports');

        // Ensure reports directory exists
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    async runTest(testName, command, timeout = 600000) {
        console.log(`\n🧪 Running ${testName}...`);
        const startTime = Date.now();

        try {
            const output = execSync(command, {
                timeout,
                encoding: 'utf8',
                stdio: 'pipe'
            });

            const duration = Date.now() - startTime;
            this.results.tests[testName] = {
                status: 'PASSED',
                duration,
                output: output.slice(-1000) // Keep last 1000 chars
            };

            console.log(`✅ ${testName} completed in ${duration}ms`);
            return true;

        } catch (error) {
            const duration = Date.now() - startTime;
            this.results.tests[testName] = {
                status: 'FAILED',
                duration,
                error: error.message,
                output: error.stdout || error.stderr || ''
            };

            console.log(`❌ ${testName} failed after ${duration}ms`);
            console.log(`Error: ${error.message}`);
            return false;
        }
    }

    async runAllTests() {
        console.log("🚀 Starting Comprehensive Testing Suite");
        console.log("=====================================");

        const tests = [
            {
                name: 'Contract Deployment',
                command: 'node scripts/deploy-contracts.js'
            },
            {
                name: 'Stress Test',
                command: 'npx hardhat test tests/stress.test.js'
            },
            {
                name: 'Network Performance Test',
                command: 'npx hardhat test tests/network.test.js'
            },
            {
                name: 'Load Test',
                command: 'npx hardhat test tests/load.test.js'
            }
        ];

        let passedTests = 0;

        for (const test of tests) {
            const success = await this.runTest(test.name, test.command);
            if (success) passedTests++;
        }

        // Generate summary
        this.results.endTime = new Date().toISOString();
        this.results.summary = {
            totalTests: tests.length,
            passedTests,
            failedTests: tests.length - passedTests,
            successRate: `${((passedTests / tests.length) * 100).toFixed(2)}%`,
            totalDuration: Object.values(this.results.tests).reduce((sum, test) => sum + test.duration, 0)
        };

        this.generateReport();
        this.printSummary();
    }

    generateReport() {
        const reportPath = path.join(this.reportsDir, 'comprehensive-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

        // Generate HTML report
        const htmlReport = this.generateHTMLReport();
        const htmlPath = path.join(this.reportsDir, 'test-report.html');
        fs.writeFileSync(htmlPath, htmlReport);

        console.log(`📊 Reports generated:`);
        console.log(`JSON: ${reportPath}`);
        console.log(`HTML: ${htmlPath}`);
    }

    generateHTMLReport() {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Sepolia vs Cardona zkEVM Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #2196F3; color: white; padding: 20px; border-radius: 5px; }
        .summary { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .test-result { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .passed { background: #e8f5e8; border-left: 4px solid #4caf50; }
        .failed { background: #ffeaea; border-left: 4px solid #f44336; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .metric-card { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Testnet Performance Comparison Report</h1>
        <p>Sepolia (ETH Layer 1) vs Cardona Polygon zkEVM (Layer 2)</p>
    </div>
    
    <div class="summary">
        <h2>📊 Test Summary</h2>
        <div class="metrics">
            <div class="metric-card">
                <h3>Total Tests</h3>
                <p>${this.results.summary.totalTests}</p>
            </div>
            <div class="metric-card">
                <h3>Success Rate</h3>
                <p>${this.results.summary.successRate}</p>
            </div>
            <div class="metric-card">
                <h3>Total Duration</h3>
                <p>${Math.round(this.results.summary.totalDuration / 1000)}s</p>
            </div>
            <div class="metric-card">
                <h3>Test Date</h3>
                <p>${new Date(this.results.startTime).toLocaleDateString()}</p>
            </div>
        </div>
    </div>
    
    <div class="test-results">
        <h2>🔍 Test Results</h2>
        ${Object.entries(this.results.tests).map(([name, result]) => `
            <div class="test-result ${result.status.toLowerCase()}">
                <h3>${name}</h3>
                <p><strong>Status:</strong> ${result.status}</p>
                <p><strong>Duration:</strong> ${result.duration}ms</p>
                ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
            </div>
        `).join('')}
    </div>
    
    <div class="footer">
        <p>Generated on ${new Date().toISOString()}</p>
    </div>
</body>
</html>`;
    }

    printSummary() {
        console.log("\n" + "=".repeat(50));
        console.log("📋 COMPREHENSIVE TEST SUMMARY");
        console.log("=".repeat(50));
        console.log(`Total Tests: ${this.results.summary.totalTests}`);
        console.log(`Passed: ${this.results.summary.passedTests}`);
        console.log(`Failed: ${this.results.summary.failedTests}`);
        console.log(`Success Rate: ${this.results.summary.successRate}`);
        console.log(`Total Duration: ${Math.round(this.results.summary.totalDuration / 1000)}s`);
        console.log("=".repeat(50));
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const runner = new TestRunner();
    runner.runAllTests()
        .then(() => {
            console.log("🎉 All tests completed!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 Test runner failed:", error);
            process.exit(1);
        });
}

module.exports = TestRunner;