const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const addressesPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const tokenCreatorAddress = addresses.TokenCreator;
  
  console.log("Checking contract code at:", tokenCreatorAddress);
  const code = await hre.ethers.provider.getCode(tokenCreatorAddress);
  console.log("Bytecode length:", code.length);
  if (code === "0x") {
    console.log("WARNING: No contract deployed at this address!");
  } else {
    console.log("Contract exists (bytecode found).");
  }
}

main().catch(console.error);
