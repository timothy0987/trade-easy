const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting USDC Treasury Funding Script...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Using deployer wallet:", deployer.address);

    const frontendPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
    if (!fs.existsSync(frontendPath)) {
        throw new Error("addresses.json not found!");
    }

    const addresses = JSON.parse(fs.readFileSync(frontendPath, "utf8"));
    const usdcAddress = addresses.USDC;
    const treasuryAddress = "0x8C7ee3Fe0A34F864723A2C58ce8fE4342fC296Cf";

    if (!usdcAddress) {
        throw new Error("USDC address not found in addresses.json!");
    }

    console.log(`USDC Address: ${usdcAddress}`);
    console.log(`Treasury Address: ${treasuryAddress}`);

    const tokenABI = [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function decimals() view returns (uint8)"
    ];

    const usdc = new hre.ethers.Contract(usdcAddress, tokenABI, deployer);

    const decimals = 6;
    console.log(`Token has ${decimals} decimals.`);
    
    const fundAmount = hre.ethers.parseUnits("5000000", decimals);
    console.log(`Executing transfer of 5,000,000 USDC to Treasury...`);

    const tx = await usdc.transfer(treasuryAddress, fundAmount, { gasLimit: 2000000 });
    console.log("Transaction submitted:", tx.hash);
    
    await tx.wait();
    console.log("Treasury Funded Successfully with USDC!");
}

main().catch((error) => {
    console.error("Error funding treasury:", error);
    process.exitCode = 1;
});
