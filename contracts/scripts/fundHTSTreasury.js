require("dotenv").config();
const { 
    Client, 
    PrivateKey, 
    TransferTransaction, 
    TokenId
} = require("@hashgraph/sdk");
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
    console.log("Starting Treasury Deployment & Funding...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Using EVM account:", deployer.address);

    const frontendPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
    const addresses = JSON.parse(fs.readFileSync(frontendPath, "utf8"));
    const teraAddressHex = addresses.TERA;
    console.log(`HTS TERA Address: ${teraAddressHex}`);

    // 1. Deploy TeraFaucet
    console.log("Deploying TeraFaucet...");
    const Faucet = await hre.ethers.getContractFactory("TeraFaucet");
    const faucet = await Faucet.deploy(teraAddressHex);
    await faucet.waitForDeployment();
    const faucetAddress = await faucet.getAddress();
    console.log("TeraFaucet deployed to:", faucetAddress);

    // 2. Associate Faucet with HTS TERA
    console.log("Associating TeraFaucet with HTS TERA...");
    const associateTx = await faucet.associateToken(teraAddressHex, { gasLimit: 1000000 });
    await associateTx.wait();
    console.log("Association successful!");

    // 3. Fund Faucet using Hedera SDK
    const myAccountId = "0.0.8596085"; 
    const privateKeyHex = process.env.PRIVATE_KEY.replace("0x", "");
    const privateKey = PrivateKey.fromStringECDSA(privateKeyHex);
    
    const client = Client.forTestnet();
    client.setOperator(myAccountId, privateKey);

    const tokenIdStr = "0.0." + parseInt(teraAddressHex.slice(-8), 16);
    console.log(`Parsed Hedera Token ID: ${tokenIdStr}`);
    
    const faucetAccountId = "0.0." + parseInt(faucetAddress.slice(-8), 16);
    console.log(`Parsed Faucet Account ID: ${faucetAccountId}`); // Note: Contract ID to Account ID mapping can be direct via EVM alias or entity ID.
    // Wait, smart contracts deployed via Ethers have a different Account ID than just the last 8 bytes if they are auto-created, but typically the EVM address is their alias.
    // TransferTransaction to an EVM address:
    console.log("Funding TeraFaucet with 5,000,000 TERA...");
    
    // 5,000,000 TERA with 8 decimals = 500,000,000,000,000
    const fundAmount = 500000000000000;
    
    const transferTx = new TransferTransaction()
        .addTokenTransfer(tokenIdStr, myAccountId, -fundAmount)
        .addTokenTransfer(tokenIdStr, faucetAddress, fundAmount) // Using the EVM address directly (Hedera SDK supports this)
        .freezeWith(client);

    const signedTx = await transferTx.sign(privateKey);
    const txResponse = await signedTx.execute(client);
    await txResponse.getReceipt(client);
    
    console.log("Faucet Funded Successfully via HTS Transfer!");

    // 4. Update Addresses
    addresses.TeraFaucet = faucetAddress;
    fs.writeFileSync(frontendPath, JSON.stringify(addresses, null, 2));
    console.log("Frontend addresses updated!");
    
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
