const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Fetch gas price from provider and add a buffer
  const feeData = await hre.ethers.provider.getFeeData();
  console.log("Recommended gas price:", feeData.gasPrice ? feeData.gasPrice.toString() : "null");
  
  // Use a buffer for gasPrice (1.5x recommended) or fallback to 3000 Gwei
  const gasPrice = feeData.gasPrice ? (feeData.gasPrice * 15n) / 10n : 3000000000000n;
  const gasLimit = 3000000n;

  console.log(`Using gasPrice: ${gasPrice.toString()} and gasLimit: ${gasLimit.toString()}`);

  // 1. Deploy TokenCreator
  console.log("Deploying TokenCreator...");
  const TokenCreator = await hre.ethers.getContractFactory("TokenCreator");
  const tokenCreator = await TokenCreator.deploy({ gasPrice, gasLimit });
  await tokenCreator.waitForDeployment();
  const tokenCreatorAddress = await tokenCreator.getAddress();
  console.log("TokenCreator deployed to:", tokenCreatorAddress);

  // 2. Deploy TradeEasyFactory
  console.log("Deploying TradeEasyFactory...");
  const TradeEasyFactory = await hre.ethers.getContractFactory("TradeEasyFactory");
  const factory = await TradeEasyFactory.deploy({ gasPrice, gasLimit });
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("TradeEasyFactory deployed to:", factoryAddress);

  // 3. Deploy TradeEasyRouter
  console.log("Deploying TradeEasyRouter...");
  const WHBAR_ADDRESS = "0xb1F616b8134F602c3Bb465fB5b5e6565cCAd37Ed";
  const TradeEasyRouter = await hre.ethers.getContractFactory("TradeEasyRouter");
  const router = await TradeEasyRouter.deploy(factoryAddress, WHBAR_ADDRESS, { gasPrice, gasLimit });
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("TradeEasyRouter deployed to:", routerAddress);

  // 4. Save contract addresses to JSON
  const outputDir = path.join(__dirname, "../../frontend/src/contracts");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const addressPath = path.join(outputDir, "addresses.json");
  let addresses = {};
  if (fs.existsSync(addressPath)) {
    addresses = JSON.parse(fs.readFileSync(addressPath, "utf8"));
  }

  addresses = {
    ...addresses,
    network: "hederaTestnet",
    chainId: 296,
    TokenCreator: tokenCreatorAddress,
    TradeEasyFactory: factoryAddress,
    TradeEasyRouter: routerAddress,
    WHBAR: WHBAR_ADDRESS,
    MockHBAR: WHBAR_ADDRESS,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    addressPath,
    JSON.stringify(addresses, null, 2)
  );
  console.log("Saved deployed addresses to:", path.join(outputDir, "addresses.json"));

  // Also save contracts ABI so frontend can import them
  const tokenCreatorArtifact = hre.artifacts.readArtifactSync("TokenCreator");
  const factoryArtifact = hre.artifacts.readArtifactSync("TradeEasyFactory");
  const routerArtifact = hre.artifacts.readArtifactSync("TradeEasyRouter");
  const pairArtifact = hre.artifacts.readArtifactSync("TradeEasyPair");

  fs.writeFileSync(path.join(outputDir, "TokenCreator.json"), JSON.stringify(tokenCreatorArtifact.abi, null, 2));
  fs.writeFileSync(path.join(outputDir, "TradeEasyFactory.json"), JSON.stringify(factoryArtifact.abi, null, 2));
  fs.writeFileSync(path.join(outputDir, "TradeEasyRouter.json"), JSON.stringify(routerArtifact.abi, null, 2));
  fs.writeFileSync(path.join(outputDir, "TradeEasyPair.json"), JSON.stringify(pairArtifact.abi, null, 2));
  console.log("ABIs successfully written to frontend src/contracts folder.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
