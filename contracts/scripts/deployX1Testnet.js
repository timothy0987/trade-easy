const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting MockTERA and TeraFaucet Deployment on X1 Testnet...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Using account:", deployer.address);

    const frontendPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
    let addresses = {};
    if (fs.existsSync(frontendPath)) {
        addresses = JSON.parse(fs.readFileSync(frontendPath, "utf8"));
    }

    // 1. Deploy MockTERA
    console.log("Deploying MockTERA...");
    const MockTERA = await hre.ethers.getContractFactory("MockTERA");
    const mockTera = await MockTERA.deploy("Trade Easy Token", "TERA", 18);
    await mockTera.waitForDeployment();
    const teraAddress = await mockTera.getAddress();
    console.log("MockTERA deployed to:", teraAddress);

    // 2. Deploy TeraFaucet
    console.log("Deploying TeraFaucet...");
    const Faucet = await hre.ethers.getContractFactory("TeraFaucet");
    const faucet = await Faucet.deploy(teraAddress);
    await faucet.waitForDeployment();
    const faucetAddress = await faucet.getAddress();
    console.log("TeraFaucet deployed to:", faucetAddress);

    // 3. Fund Faucet directly from deployer since MockTERA minted to deployer
    console.log("Funding TeraFaucet with 5,000,000 TERA...");
    const fundAmount = hre.ethers.parseUnits("5000000", 18);
    const fundTx = await mockTera.transfer(faucetAddress, fundAmount);
    await fundTx.wait();
    console.log("Faucet Funded Successfully!");

    // 4. Update Addresses
    addresses.TERA = teraAddress;
    addresses.TeraFaucet = faucetAddress;
    fs.writeFileSync(frontendPath, JSON.stringify(addresses, null, 2));
    console.log("Frontend addresses updated!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
