const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying tokens with account:", deployer.address);

  // Read addresses.json
  const addressesPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
  if (!fs.existsSync(addressesPath)) {
    throw new Error(`addresses.json not found at: ${addressesPath}`);
  }
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

  // Deploy TERA
  console.log("Deploying TERA token...");
  const TERAFactory = await hre.ethers.getContractFactory("TERA");
  const tera = await TERAFactory.deploy({ gasLimit: 3000000n });
  await tera.waitForDeployment();
  const teraAddress = await tera.getAddress();
  console.log("TERA deployed to:", teraAddress);

  // Deploy MockHBAR
  console.log("Deploying MockHBAR token...");
  const MockHBARFactory = await hre.ethers.getContractFactory("MockHBAR");
  const hbar = await MockHBARFactory.deploy({ gasLimit: 3000000n });
  await hbar.waitForDeployment();
  const hbarAddress = await hbar.getAddress();
  console.log("MockHBAR deployed to:", hbarAddress);

  // Deploy TeraFaucet
  console.log("Deploying TeraFaucet...");
  const FaucetFactory = await hre.ethers.getContractFactory("TeraFaucet");
  const faucet = await FaucetFactory.deploy(teraAddress, { gasLimit: 3000000n });
  await faucet.waitForDeployment();
  const faucetAddress = await faucet.getAddress();
  console.log("TeraFaucet deployed to:", faucetAddress);

  // Mint initial supply to deployer for AMM
  console.log("Minting 10,000 TERA and MockHBAR to deployer...");
  const amount = hre.ethers.parseEther("10000");
  await (await tera.mint(deployer.address, amount)).wait();
  await (await hbar.mint(deployer.address, amount)).wait();

  // Mint treasury supply to deployer and transfer to Faucet
  console.log("Minting 5,000,000 TERA for Faucet treasury...");
  const treasuryAmount = hre.ethers.parseEther("5000000");
  await (await tera.mint(deployer.address, treasuryAmount)).wait();
  await (await tera.transfer(faucetAddress, treasuryAmount)).wait();

  // Add Liquidity
  const routerAddress = addresses.TradeEasyRouter;
  if (!routerAddress) throw new Error("TradeEasyRouter address not found");
  
  console.log("Approving router to spend tokens...");
  await (await tera.approve(routerAddress, amount)).wait();
  await (await hbar.approve(routerAddress, amount)).wait();

  console.log("Adding 1:1 liquidity to TERA/HBAR pool...");
  const TradeEasyRouter = await hre.ethers.getContractAt("TradeEasyRouter", routerAddress);
  const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes

  await (await TradeEasyRouter.addLiquidity(
    teraAddress,
    hbarAddress,
    amount,
    amount,
    0, // minAmountA
    0, // minAmountB
    deployer.address,
    deadline,
    { gasLimit: 5000000n }
  )).wait();
  console.log("Liquidity added successfully!");

  // Update addresses.json
  addresses.TERA = teraAddress;
  addresses.MockHBAR = hbarAddress;
  addresses.TeraFaucet = faucetAddress;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("Successfully updated addresses.json with new addresses.");

  // Save ABIs
  const outputDir = path.join(__dirname, "../../frontend/src/contracts");
  const teraArtifact = hre.artifacts.readArtifactSync("TERA");
  const hbarArtifact = hre.artifacts.readArtifactSync("MockHBAR");
  const faucetArtifact = hre.artifacts.readArtifactSync("TeraFaucet");

  fs.writeFileSync(path.join(outputDir, "TERA.json"), JSON.stringify(teraArtifact.abi, null, 2));
  fs.writeFileSync(path.join(outputDir, "MockHBAR.json"), JSON.stringify(hbarArtifact.abi, null, 2));
  fs.writeFileSync(path.join(outputDir, "TeraFaucet.json"), JSON.stringify(faucetArtifact.abi, null, 2));
  console.log("ABIs successfully written to frontend src/contracts folder.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
