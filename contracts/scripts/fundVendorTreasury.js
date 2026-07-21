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
    console.log("Starting TokenVendor Treasury Funding...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Using EVM account:", deployer.address);

    const frontendPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
    const addresses = JSON.parse(fs.readFileSync(frontendPath, "utf8"));
    const teraAddressHex = addresses.TERA;
    const vendorAddressHex = addresses.TokenVendor;

    if (!teraAddressHex || !vendorAddressHex) {
        throw new Error("Missing TERA or TokenVendor address in addresses.json");
    }

    console.log(`HTS TERA Address: ${teraAddressHex}`);
    console.log(`TokenVendor Address: ${vendorAddressHex}`);

    // 1. Associate TokenVendor with HTS TERA
    console.log("Associating TokenVendor with HTS TERA...");
    const Vendor = await hre.ethers.getContractAt("TokenVendor", vendorAddressHex);
    try {
        const associateTx = await Vendor.associateToken(teraAddressHex, { gasLimit: 1000000 });
        await associateTx.wait();
        console.log("Association successful!");
    } catch (e) {
        console.log("Association might have already been done or failed:", e.message);
    }

    // 2. Fund TokenVendor using Hedera SDK
    const myAccountId = "0.0.8596085"; 
    const privateKeyHex = process.env.PRIVATE_KEY.replace("0x", "");
    const privateKey = PrivateKey.fromStringECDSA(privateKeyHex);
    
    const client = Client.forTestnet();
    client.setOperator(myAccountId, privateKey);

    const tokenIdStr = "0.0." + parseInt(teraAddressHex.slice(-8), 16);
    console.log(`Parsed Hedera Token ID: ${tokenIdStr}`);
    
    console.log("Funding TokenVendor with 5,000,000 TERA...");
    
    // 5,000,000 TERA with 8 decimals = 500,000,000,000,000
    const fundAmount = 500000000000000;
    
    const transferTx = new TransferTransaction()
        .addTokenTransfer(tokenIdStr, myAccountId, -fundAmount)
        .addTokenTransfer(tokenIdStr, vendorAddressHex, fundAmount) 
        .freezeWith(client);

    const signedTx = await transferTx.sign(privateKey);
    const txResponse = await signedTx.execute(client);
    await txResponse.getReceipt(client);
    
    console.log("TokenVendor Funded Successfully via HTS Transfer!");
    
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
