const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying TERA with account:", deployer.address);

  // Existing TokenCreator contract address
  const tokenCreatorAddress = "0x17ac1C0fc9A33c43550A79ED1631c17e134212E3";
  
  // Attach to TokenCreator contract
  const TokenCreator = await hre.ethers.getContractAt("TokenCreator", tokenCreatorAddress);

  const name = "Trade Easy Token";
  const symbol = "TERA";
  const decimals = 18;
  const initialSupply = 1000000000000000000n; // 1 TERA base unit with 18 decimals

  console.log(`Creating token ${name} (${symbol})...`);
  
  // Call createToken, value of 40 HBAR (in wei)
  const tx = await TokenCreator.createToken(
    name,
    symbol,
    initialSupply,
    decimals,
    { value: hre.ethers.parseEther("40"), gasLimit: 15000000 }
  );

  console.log("Transaction sent. Waiting for receipt...");
  const receipt = await tx.wait();

  // Parse TokenCreated event to get the EVM token address
  let teraAddress = null;
  for (const log of receipt.logs) {
    try {
      const parsedLog = TokenCreator.interface.parseLog(log);
      if (parsedLog && parsedLog.name === "TokenCreated") {
        teraAddress = parsedLog.args.tokenAddress;
        break;
      }
    } catch (e) {
      // Ignore logs that don't match the interface
    }
  }

  if (!teraAddress) {
    throw new Error("TokenCreated event not found in transaction receipt.");
  }

  console.log(`TERA Token EVM Address: ${teraAddress}`);

  // Write to addresses.json
  const outputDir = path.join(__dirname, "../../frontend/src/contracts");
  const addressPath = path.join(outputDir, "addresses.json");
  
  let addresses = {};
  if (fs.existsSync(addressPath)) {
    addresses = JSON.parse(fs.readFileSync(addressPath, "utf8"));
  }

  addresses = {
    ...addresses,
    TERA: teraAddress
  };

  fs.writeFileSync(addressPath, JSON.stringify(addresses, null, 2));
  console.log(`Saved TERA address to addresses.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
