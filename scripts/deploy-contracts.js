const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const network = hre.network.name;
    console.log(`🚀 Deploying to ${network}...`);

    const TicketMarketplace = await hre.ethers.getContractFactory("TicketMarketplace");
    const contract = await TicketMarketplace.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    const deploymentHash = contract.deploymentTransaction()?.hash;

    console.log(`✅ Deployed to ${address}`);

    const deploymentsPath = path.join(__dirname, "..", "deployments.json");

    // Read existing deployments if any
    let deployments = {};
    if (fs.existsSync(deploymentsPath)) {
        deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    }

    deployments[network] = {
        address,
        deploymentHash,
        network,
    };

    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));

    console.log(`📦 Saved deployment to deployments.json`);
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
});
