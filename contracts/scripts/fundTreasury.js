const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting Treasury Funding Script...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Using account:", deployer.address);

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
    console.log(`Faucet Address: ${faucetAddress}`);

    // Assuming standard ERC20 interface
    const teraABI = [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function balanceOf(address account) view returns (uint256)"
    ];

    const tera = new hre.ethers.Contract(teraAddress, teraABI, deployer);

    const initialBalance = await tera.balanceOf(deployer.address);
    console.log(`Deployer initial TERA balance: ${hre.ethers.formatEther(initialBalance)}`);

    const fundAmount = hre.ethers.parseUnits("5000000", 18);
    
    if (initialBalance < fundAmount) {
        console.warn("WARNING: Deployer balance is less than 5,000,000 TERA! Transfer may fail if not enough funds.");
    }

    console.log(`Transferring 5,000,000 TERA to Faucet...`);
    const tx = await tera.transfer(faucetAddress, fundAmount);
    console.log(`Transaction sent! Hash: ${tx.hash}`);
    
    await tx.wait();
    console.log("Transfer confirmed!");
    
    const faucetBalance = await tera.balanceOf(faucetAddress);
    console.log(`New Faucet TERA balance: ${hre.ethers.formatEther(faucetBalance)}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
