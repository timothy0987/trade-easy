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
  const gasLimit = 8000000n;

  const outputDir = path.join(__dirname, "../../frontend/src/contracts");
  const addressPath = path.join(outputDir, "addresses.json");
  
  let addresses = {};
  if (fs.existsSync(addressPath)) {
    addresses = JSON.parse(fs.readFileSync(addressPath, "utf8"));
  }

  const teraAddress = addresses.TERA;
  if (!teraAddress) {
    throw new Error("TERA address not found in addresses.json. Run deployTera.js first.");
  }

  // 1. Deploy TokenVendor
  console.log("Deploying TokenVendor...");
  const TokenVendor = await hre.ethers.getContractFactory("TokenVendor");
  const vendor = await TokenVendor.deploy(teraAddress, { gasPrice, gasLimit });
  await vendor.waitForDeployment();
  const vendorAddress = await vendor.getAddress();
  console.log("TokenVendor deployed to:", vendorAddress);

  // 2. Fund TokenVendor with TERA
  console.log("Funding TokenVendor with TERA...");
  const fundAmount = 1000000000000000000n; // Transfer the whole 1 TERA initially minted
  try {
      const tokenCreatorAddress = "0x17ac1C0fc9A33c43550A79ED1631c17e134212E3";
      const TokenCreator = await hre.ethers.getContractAt("TokenCreator", tokenCreatorAddress);
      const tx = await TokenCreator.transferOut(teraAddress, vendorAddress, fundAmount, { gasPrice, gasLimit });
      await tx.wait();
      console.log(`Successfully funded TokenVendor with 1 TERA via TokenCreator`);
  } catch (e) {
      console.log("Failed to fund vendor via TokenCreator. Error:", e.message);
  }

  // 3. Save contract addresses to JSON
  addresses = {
    ...addresses,
    TokenVendor: vendorAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(addressPath, JSON.stringify(addresses, null, 2));
  console.log("Saved deployed addresses to:", addressPath);

  // Also save contracts ABI so frontend can import them
  const vendorArtifact = hre.artifacts.readArtifactSync("TokenVendor");
  fs.writeFileSync(path.join(outputDir, "TokenVendor.json"), JSON.stringify(vendorArtifact.abi, null, 2));
  console.log("ABI successfully written to frontend src/contracts folder.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
