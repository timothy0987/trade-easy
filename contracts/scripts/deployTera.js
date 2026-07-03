const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Calling TokenCreator with account:", deployer.address);

  // Address of TokenCreator from addresses.json
  const addressesPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
  if (!fs.existsSync(addressesPath)) {
    throw new Error(`addresses.json not found at: ${addressesPath}`);
  }
  console.log("Deploying MockTERA as a stable mock for HTS...");
  const MockTERA = await hre.ethers.getContractFactory("MockTERA");
  const tera = await MockTERA.deploy({ gasLimit: 3000000n });
  await tera.waitForDeployment();
  const TERAAddress = await tera.getAddress();
  console.log("MockTERA deployed to:", TERAAddress);

  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  addresses.TERA = TERAAddress;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("Successfully updated addresses.json with TERA:", TERAAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
