require("dotenv").config();
const { 
    Client, 
    PrivateKey, 
    TokenCreateTransaction, 
    TokenType, 
    TokenSupplyType,
    TokenId
} = require("@hashgraph/sdk");
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
    console.log("Starting HTS TERA deployment using Hedera SDK...");

    // Setup Hedera Client
    const myAccountId = "0.0.8596085";
    const privateKeyHex = process.env.PRIVATE_KEY.replace("0x", "");
    const privateKey = PrivateKey.fromStringECDSA(privateKeyHex);
    
    const client = Client.forTestnet();
    client.setOperator(myAccountId, privateKey);

    console.log("Deploying HTS Token with operator Account ID:", myAccountId);

    // Create the token
    const tokenCreateTx = new TokenCreateTransaction()
        .setTokenName("Trade Easy Token")
        .setTokenSymbol("TERA")
        .setTokenType(TokenType.FungibleCommon)
        .setDecimals(8)
        .setInitialSupply(10000000000000000) 
        .setTreasuryAccountId(myAccountId)
        .setSupplyKey(privateKey)
        .setTokenMemo("Native HTS TERA");

    console.log("Submitting TokenCreateTransaction to Hedera TestNet...");
    const txResponse = await tokenCreateTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    const tokenId = receipt.tokenId;
    console.log(`HTS TERA Token created successfully! Token ID: ${tokenId}`);

    // Convert Token ID to EVM Address
    const teraEvmAddress = tokenId.toSolidityAddress();
    const teraAddressHex = "0x" + teraEvmAddress;
    console.log(`HTS TERA EVM Address: ${teraAddressHex}`);

    // Save to addresses.json
    const frontendPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
    let addresses = {};
    if (fs.existsSync(frontendPath)) {
        addresses = JSON.parse(fs.readFileSync(frontendPath, "utf8"));
    }
    
    addresses.TERA = teraAddressHex;
    fs.writeFileSync(frontendPath, JSON.stringify(addresses, null, 2));
    console.log("Frontend addresses.json updated with new HTS TERA address!");
    
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
