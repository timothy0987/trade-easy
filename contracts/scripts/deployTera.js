const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting Trade Easy deployment to Hedera TestNet...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // 1. Deploy the $TERA Token (Using your existing HTS Creator or standard ERC20)
    // Assuming a standard ERC20 mock for the testnet environment for seamless AMM integration
    const Tera = await hre.ethers.getContractFactory("MockTERA"); // Ensure you have a standard ERC20 MockTERA compiled
    const tera = await Tera.deploy("Trade Easy Token", "TERA", 18);
    await tera.waitForDeployment();
    const teraAddress = await tera.getAddress();
    console.log("$TERA Token deployed to:", teraAddress);

    // 2. Deploy the TeraFaucet (The Treasury Vault)
    const Faucet = await hre.ethers.getContractFactory("TeraFaucet");
    const faucet = await Faucet.deploy(teraAddress);
    await faucet.waitForDeployment();
    const faucetAddress = await faucet.getAddress();
    console.log("TeraFaucet Treasury deployed to:", faucetAddress);

    // 3. Fund the Treasury
    // Mint or transfer 5,000,000 $TERA (with 18 decimals) directly to the Faucet contract
    const treasuryFundingAmount = hre.ethers.parseUnits("5000000", 18);
    console.log("Funding the Faucet Treasury with 5,000,000 $TERA...");
    
    const fundTx = await tera.transfer(faucetAddress, treasuryFundingAmount);
    await fundTx.wait();
    console.log("Faucet Treasury successfully funded!");

    // 2.5 Deploy Mock USDC
    console.log("Deploying Mock USDC token...");
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log("Mock USDC deployed to:", usdcAddress);

    // 4. Save Addresses for the Frontend
    // We will preserve existing addresses so frontend components don't break
    const frontendPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
    let addresses = {};
    if (fs.existsSync(frontendPath)) {
        addresses = JSON.parse(fs.readFileSync(frontendPath, "utf8"));
    }
    
    // 5. Initialize AMM liquidity for TERA/USDC
    const routerAddress = addresses.TradeEasyRouter;
    if (routerAddress) {
        console.log("Adding 1:1 liquidity to TERA/USDC pool...");
        const TradeEasyRouter = await hre.ethers.getContractAt("TradeEasyRouter", routerAddress);
        
        // 10,000 TERA and 10,000 USDC
        const teraLpAmount = hre.ethers.parseUnits("10000", 18);
        const usdcLpAmount = hre.ethers.parseUnits("10000", 6);

        await (await tera.approve(routerAddress, teraLpAmount)).wait();
        await (await usdc.approve(routerAddress, usdcLpAmount)).wait();

        const deadline = Math.floor(Date.now() / 1000) + 600;
        await (await TradeEasyRouter.addLiquidity(
            teraAddress,
            usdcAddress,
            teraLpAmount,
            usdcLpAmount,
            0,
            0,
            deployer.address,
            deadline,
            { gasLimit: 5000000n }
        )).wait();
        console.log("TERA/USDC Liquidity added successfully!");
    } else {
        console.log("TradeEasyRouter not found. Skipping liquidity initialization.");
    }

    addresses.TERA = teraAddress;
    addresses.TeraFaucet = faucetAddress;
    addresses.USDC = usdcAddress;

    fs.writeFileSync(frontendPath, JSON.stringify(addresses, null, 2));
    console.log("Frontend addresses updated!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
