const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploys ProfileRegistry (shared on-chain display name + avatar) and merges the
 * address + ABI into frontend/src/contracts.
 *
 *   npm run deploy:profile
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const outDir = path.join(__dirname, "../../frontend/src/contracts");
  const addrPath = path.join(outDir, "addresses.json");
  const A = fs.existsSync(addrPath) ? JSON.parse(fs.readFileSync(addrPath, "utf8")) : {};

  console.log(`Network : ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const reg = await (await hre.ethers.getContractFactory("ProfileRegistry")).deploy();
  await reg.waitForDeployment();
  const addr = await reg.getAddress();
  console.log(`ProfileRegistry -> ${addr}`);

  A.ProfileRegistry = addr;
  A.timestamp = new Date().toISOString();
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(addrPath, JSON.stringify(A, null, 2));

  const art = hre.artifacts.readArtifactSync("ProfileRegistry");
  fs.writeFileSync(path.join(outDir, "ProfileRegistry.json"), JSON.stringify(art.abi, null, 2));
  console.log("Merged ProfileRegistry + ABI into frontend/src/contracts/");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
