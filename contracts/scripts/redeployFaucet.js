const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting TeraFaucet Redeployment & Funding...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Using account:", deployer.address);

    const frontendPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
    if (!fs.existsSync(frontendPath)) {
        throw new Error("addresses.json not found!");
    }

    const addresses = JSON.parse(fs.readFileSync(frontendPath, "utf8"));
    const teraAddress = addresses.TERA;

    if (!teraAddress) {
        throw new Error("TERA address not found in addresses.json!");
    }
    console.log(`HTS TERA Address: ${teraAddress}`);

    // 1. Deploy TeraFaucet
    console.log("Deploying TeraFaucet...");
    const Faucet = await hre.ethers.getContractFactory("TeraFaucet");
    const faucet = await Faucet.deploy(teraAddress);
    await faucet.waitForDeployment();
    const faucetAddress = await faucet.getAddress();
    console.log("TeraFaucet deployed to:", faucetAddress);

    // 2. Associate Faucet with HTS TERA
    console.log("Associating TeraFaucet with HTS TERA...");
    const associateTx = await faucet.associateToken(teraAddress, { gasLimit: 1000000 });
    await associateTx.wait();
    console.log("Association successful!");

    // 3. Fund Faucet from HTSTeraDeployer
    console.log("Funding TeraFaucet with 5,000,000 TERA...");
    const DeployerFactory = await hre.ethers.getContractFactory("HTSTeraDeployer");
    const htsDeployer = DeployerFactory.attach(addresses.HTSDeployer);
    
    // 5,000,000 TERA with 8 decimals
    const fundAmount = hre.ethers.parseUnits("5000000", 8);
    const fundTx = await htsDeployer.transferOut(teraAddress, faucetAddress, fundAmount);
    await fundTx.wait();
    console.log("Faucet Funded Successfully!");

    // 4. Update Addresses
    addresses.TeraFaucet = faucetAddress;
    fs.writeFileSync(frontendPath, JSON.stringify(addresses, null, 2));
    console.log("Frontend addresses updated!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
