require("dotenv").config();
const { 
    Client, 
    PrivateKey, 
    TransferTransaction
} = require("@hashgraph/sdk");
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
    console.log("Starting Treasury HTS USDC Funding Script...");

    const [deployer] = await hre.ethers.getSigners();

    const frontendPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
    const addresses = JSON.parse(fs.readFileSync(frontendPath, "utf8"));
    const usdcAddressHex = addresses.USDC;
    const treasuryAddress = addresses.TeraFaucet;

    console.log(`HTS USDC Address: ${usdcAddressHex}`);
    console.log(`Treasury Address: ${treasuryAddress}`);

    // 1. Associate Treasury with HTS USDC
    console.log("Associating Treasury with HTS USDC...");
    const Faucet = await hre.ethers.getContractFactory("TeraFaucet");
    const faucet = Faucet.attach(treasuryAddress);
    
    // Check if already associated by trying to transfer a tiny amount? No, we can just call associateToken.
    // If it's already associated, it might revert or return success. Let's just call it.
    try {
        const associateTx = await faucet.associateToken(usdcAddressHex, { gasLimit: 1000000 });
        await associateTx.wait();
        console.log("Association successful!");
    } catch (e) {
        console.log("Association might have already been done, or failed:", e.message);
    }

    // 2. Fund Faucet using Hedera SDK
    const myAccountId = "0.0.8596085"; 
    const privateKeyHex = process.env.PRIVATE_KEY.replace("0x", "");
    const privateKey = PrivateKey.fromStringECDSA(privateKeyHex);
    
    const client = Client.forTestnet();
    client.setOperator(myAccountId, privateKey);

    const tokenIdStr = "0.0." + parseInt(usdcAddressHex.slice(-8), 16);
    console.log(`Parsed Hedera Token ID: ${tokenIdStr}`);
    
    console.log("Funding Treasury with 5,000,000 native HTS USDC...");
    
    // 5,000,000 USDC with 6 decimals = 5,000,000,000,000
    const fundAmount = 5000000000000;
    
    const transferTx = new TransferTransaction()
        .addTokenTransfer(tokenIdStr, myAccountId, -fundAmount)
        .addTokenTransfer(tokenIdStr, treasuryAddress, fundAmount) // Using the EVM address directly
        .freezeWith(client);

    const signedTx = await transferTx.sign(privateKey);
    const txResponse = await signedTx.execute(client);
    await txResponse.getReceipt(client);
    
    console.log("Treasury Funded Successfully via native HTS Transfer!");

    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
