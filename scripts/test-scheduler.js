const cron = require('node-cron');
const TestRunner = require('./run-test');
const BenchmarkComparison = require('./benchmark');
const RealTimeMonitor = require('./monitor');

class TestScheduler {
    constructor() {
        this.testRunner = new TestRunner();
        this.benchmarkComparison = new BenchmarkComparison();
    }

    startScheduledTesting() {
        console.log("⏰ Starting automated test scheduler...");

        // Run comprehensive tests every 6 hours
        cron.schedule('0 */6 * * *', async () => {
            console.log("🔄 Running scheduled comprehensive tests...");
            try {
                await this.testRunner.runAllTests();
                await this.benchmarkComparison.generateComparison();
                console.log("✅ Scheduled tests completed successfully");
            } catch (error) {
                console.error("❌ Scheduled tests failed:", error);
            }
        });

        // Generate daily reports
        cron.schedule('0 9 * * *', async () => {
            console.log("📊 Generating daily benchmark report...");
            try {
                await this.benchmarkComparison.generateComparison();
                console.log("✅ Daily report generated");
            } catch (error) {
                console.error("❌ Daily report generation failed:", error);
            }
        });

        console.log("⏰ Test scheduler is running...");
        console.log("- Comprehensive tests: Every 6 hours");
        console.log("- Daily reports: Every day at 9 AM");
    }
}

module.exports = {
    TestRunner,
    RealTimeMonitor,
    BenchmarkComparison,
    TestScheduler
};
