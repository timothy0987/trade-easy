const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploys ZenStakingPool against the ALREADY-DEPLOYED PrivateTradingVault and wires it
 * as the vault's fee-share recipient via setFeeRecipients (keeps the current feeRecipient).
 *
 *   npm run deploy:staking
 *
 * Needs PrivateTradingVault + ZEN in frontend/src/contracts/addresses.json.
 * Must be run by the vault owner (deployer).
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const outDir = path.join(__dirname, "../../frontend/src/contracts");
  const addrPath = path.join(outDir, "addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addrPath, "utf8"));

  const vaultAddr = addresses.PrivateTradingVault;
  const zenToken = addresses.ZEN;
  if (!vaultAddr) throw new Error("PrivateTradingVault missing from addresses.json — run deploy:vault first");
  if (!zenToken) throw new Error("ZEN (tZEN) address missing from addresses.json");

  console.log(`Network : ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Vault   : ${vaultAddr}`);
  console.log(`ZEN     : ${zenToken}`);

  const vault = await hre.ethers.getContractAt("PrivateTradingVault", vaultAddr);
  const owner = await vault.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer is not the vault owner (owner is ${owner})`);
  }
  const currentFeeRecipient = await vault.feeRecipient();

  const Pool = await hre.ethers.getContractFactory("ZenStakingPool");
  const pool = await Pool.deploy(zenToken, vaultAddr, deployer.address);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`ZenStakingPool -> ${poolAddr}`);

  console.log("Wiring vault.setFeeRecipients(feeRecipient, stakingPool)...");
  await (await vault.setFeeRecipients(currentFeeRecipient, poolAddr)).wait();
  console.log(`  feeRecipient : ${await vault.feeRecipient()}`);
  console.log(`  stakingPool  : ${await vault.stakingPool()}`);
  console.log(`  stakingFeeShareBps: ${(await vault.stakingFeeShareBps()).toString()}`);

  addresses.ZenStakingPool = poolAddr;
  addresses.timestamp = new Date().toISOString();
  fs.writeFileSync(addrPath, JSON.stringify(addresses, null, 2));

  const art = hre.artifacts.readArtifactSync("ZenStakingPool");
  fs.writeFileSync(path.join(outDir, "ZenStakingPool.json"), JSON.stringify(art.abi, null, 2));
  console.log("Merged ZenStakingPool address + ABI into frontend/src/contracts/");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
