const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting Treasury Funding Script...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Using deployer wallet:", deployer.address);

    const frontendPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
    if (!fs.existsSync(frontendPath)) {
        throw new Error("addresses.json not found!");
    }

    const addresses = JSON.parse(fs.readFileSync(frontendPath, "utf8"));
    const teraAddress = addresses.TERA;
    const faucetAddress = addresses.TeraFaucet;

    if (!teraAddress || !faucetAddress) {
        throw new Error("TERA or TeraFaucet address not found in addresses.json!");
    }

    console.log(`TERA Address: ${teraAddress}`);
    console.log(`TeraFaucet Address: ${faucetAddress}`);

    const teraABI = [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function decimals() view returns (uint8)"
    ];

    const tera = new hre.ethers.Contract(teraAddress, teraABI, deployer);

    // Fetch decimals to ensure correct funding amount.
    // If it's HTS, it might have 8 decimals. If ERC20 Mock, 18.
    let decimals = 18;
    try {
        decimals = await tera.decimals();
    } catch (e) {
        console.log("Could not fetch decimals, defaulting to 18");
    }

    console.log(`Token has ${decimals} decimals.`);
    
    const fundAmount = hre.ethers.parseUnits("5000000", decimals);
    console.log(`Executing transfer of 5,000,000 TERA to Faucet...`);

    const tx = await tera.transfer(faucetAddress, fundAmount, { gasLimit: 2000000 });
    console.log("Transaction submitted:", tx.hash);
    
    await tx.wait();
    console.log("Faucet Funded Successfully!");
}

main().catch((error) => {
    console.error("Error funding treasury:", error);
    process.exitCode = 1;
});
