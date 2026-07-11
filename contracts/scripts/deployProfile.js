const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting UserProfile deployment to Hedera TestNet...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    const UserProfile = await hre.ethers.getContractFactory("UserProfile");
    const profile = await UserProfile.deploy();
    await profile.waitForDeployment();
    const profileAddress = await profile.getAddress();
    console.log("UserProfile deployed to:", profileAddress);

    // Update addresses.json
    const frontendPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
    let addresses = {};
    if (fs.existsSync(frontendPath)) {
        addresses = JSON.parse(fs.readFileSync(frontendPath, "utf8"));
    }
    
    addresses.UserProfile = profileAddress;

    fs.writeFileSync(frontendPath, JSON.stringify(addresses, null, 2));
    console.log("Frontend addresses updated!");
    
    // Save ABI
    const profileArtifact = hre.artifacts.readArtifactSync("UserProfile");
    const abiPath = path.join(__dirname, "../../frontend/src/contracts/UserProfile.json");
    fs.writeFileSync(abiPath, JSON.stringify(profileArtifact.abi, null, 2));
    console.log("ABI updated!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
