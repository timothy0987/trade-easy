const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying ONLY TradeEasyRouter with the account:", deployer.address);

  const feeData = await hre.ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice ? (feeData.gasPrice * 15n) / 10n : 3000000000000n;
  const gasLimit = 3000000n;

  // Load existing addresses to get the Factory address
  const addressesPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  
  const factoryAddress = addresses.TradeEasyFactory;
  const WHBAR_ADDRESS = "0x000000000000000000000000000000000000016a";

  console.log("Using existing Factory:", factoryAddress);
  console.log("Using WHBAR:", WHBAR_ADDRESS);

  const TradeEasyRouter = await hre.ethers.getContractFactory("TradeEasyRouter");
  const router = await TradeEasyRouter.deploy(factoryAddress, WHBAR_ADDRESS, { gasPrice, gasLimit });
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  
  console.log("New TradeEasyRouter deployed to:", routerAddress);

  // Update addresses.json
  addresses.TradeEasyRouter = routerAddress;
  addresses.timestamp = new Date().toISOString();
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("Updated addresses.json with new Router address.");

  // Write new ABI
  const routerArtifact = hre.artifacts.readArtifactSync("TradeEasyRouter");
  const abiPath = path.join(__dirname, "../../frontend/src/contracts/TradeEasyRouter.json");
  fs.writeFileSync(abiPath, JSON.stringify(routerArtifact.abi, null, 2));
  console.log("Updated TradeEasyRouter.json ABI.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
