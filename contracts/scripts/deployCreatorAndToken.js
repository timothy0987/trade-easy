const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting Full On-Chain Deployment...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // 1. Deploy TokenCreator
    const Creator = await hre.ethers.getContractFactory("TokenCreator");
    const creator = await Creator.deploy();
    await creator.waitForDeployment();
    const creatorAddress = await creator.getAddress();
    console.log("TokenCreator deployed to:", creatorAddress);

    console.log("Waiting 15 seconds for Hedera to index the contract...");
    await new Promise(r => setTimeout(r, 15000));

    // 2. Create HTS TERA Token
    console.log("Creating HTS TERA Token...");
    const initialSupply = "10000000000000000";
    const decimals = 8;
    
    let tx;
    let retries = 10;
    while (retries > 0) {
        try {
            console.log(`Attempting createToken... (${11 - retries}/10)`);
            tx = await creator.createToken("Trade Easy Token", "TERA", initialSupply, decimals, { value: hre.ethers.parseEther("50"), gasLimit: 5000000 });
            break; // Success
        } catch (e) {
            console.log("Creation reverted (likely contract not indexed yet). Retrying in 15 seconds...");
            await new Promise(r => setTimeout(r, 15000));
            retries--;
        }
    }
    
    if (!tx) throw new Error("Failed to create token after multiple retries");
    
    const receipt = await tx.wait();

    let teraAddress = null;
    for (const log of receipt.logs) {
        try {
            if (log.topics[0] === "0xb07e283733cd84d9fbd81b67f339f4d1e2e42d7653bbdf607613ba2dd958ab1b") { // TokenCreated event topic
                // The tokenAddress is the second indexed parameter
                teraAddress = hre.ethers.dataSlice(log.topics[2], 12);
                break;
            }
        } catch (e) {}
    }

    if (!teraAddress) {
        console.log("Logs:", receipt.logs);
        throw new Error("Failed to extract HTS token address from logs");
    }

    console.log("HTS TERA Token deployed successfully to:", teraAddress);

    // 3. Deploy TeraFaucet
    console.log("Deploying TeraFaucet...");
    const Faucet = await hre.ethers.getContractFactory("TeraFaucet");
    const faucet = await Faucet.deploy(teraAddress);
    await faucet.waitForDeployment();
    const faucetAddress = await faucet.getAddress();
    console.log("TeraFaucet deployed to:", faucetAddress);

    // 4. Associate Faucet
    console.log("Associating TeraFaucet with HTS TERA...");
    const associateTx = await faucet.associateToken(teraAddress, { gasLimit: 1000000 });
    await associateTx.wait();
    console.log("Association successful!");

    // 5. Transfer tokens to Faucet
    console.log("Funding TeraFaucet with 5,000,000 TERA...");
    const fundAmount = hre.ethers.parseUnits("5000000", 8); // 5 million TERA
    const fundTx = await creator.transferOut(teraAddress, faucetAddress, fundAmount, { gasLimit: 1000000 });
    await fundTx.wait();
    console.log("Faucet Funded Successfully!");

    // 6. Update Addresses
    const frontendPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
    let addresses = {};
    if (fs.existsSync(frontendPath)) {
        addresses = JSON.parse(fs.readFileSync(frontendPath, "utf8"));
    }
    
    addresses.TERA = teraAddress;
    addresses.TeraFaucet = faucetAddress;
    addresses.TokenCreator = creatorAddress; // Optionally update token creator
    
    fs.writeFileSync(frontendPath, JSON.stringify(addresses, null, 2));
    console.log("Frontend addresses updated!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
