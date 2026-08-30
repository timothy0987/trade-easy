const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploys the trading venue the vault's agent swaps against.
 *
 *   npm run deploy:venue
 *
 * - MockERC20 "USD Coin" (USDC, 18d, open mint)
 * - MockERC20 "Horizen ZEN" (ZEN, 18d, open mint) — also the ZenStakingPool staking token
 * - Generic TokenVendor(owner, rate=100, [USDC, ZEN]) — fixed-rate ETH<->token / token<->token
 * - Seeds 5M USDC + 5M ZEN into the vendor treasury
 *
 * Merges USDC / ZEN / TokenVendor + the ABI into frontend/src/contracts.
 * Run `npm run fund` afterwards to give the vendor ETH for token->ETH swaps.
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const outDir = path.join(__dirname, "../../frontend/src/contracts");
  const addrPath = path.join(outDir, "addresses.json");
  const A = fs.existsSync(addrPath) ? JSON.parse(fs.readFileSync(addrPath, "utf8")) : {};

  console.log(`Network : ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const deploy = async (name, args = []) => {
    const c = await (await hre.ethers.getContractFactory(name)).deploy(...args);
    await c.waitForDeployment();
    const a = await c.getAddress();
    console.log(`  ${name} -> ${a}`);
    return c;
  };

  const usdc = await deploy("MockERC20", ["USD Coin", "USDC", 18]);
  const zen = await deploy("MockERC20", ["Horizen ZEN", "ZEN", 18]);
  const usdcAddr = await usdc.getAddress();
  const zenAddr = await zen.getAddress();

  const vendor = await deploy("TokenVendor", [deployer.address, 100n, [usdcAddr, zenAddr]]);
  const vendorAddr = await vendor.getAddress();

  console.log("Seeding vendor treasury (5M USDC / ZEN)...");
  const amt = hre.ethers.parseEther("5000000");
  await (await usdc.mint(vendorAddr, amt)).wait();
  await (await zen.mint(vendorAddr, amt)).wait();

  A.USDC = usdcAddr;
  A.ZEN = zenAddr;
  A.TokenVendor = vendorAddr;
  A._zenNote =
    "Horizen ZEN — our own MockERC20 (18d, open mint) so the vendor, users and the " +
    "staking pool can hold it. Point ZEN at Horizen's canonical token once published.";
  A.timestamp = new Date().toISOString();
  fs.writeFileSync(addrPath, JSON.stringify(A, null, 2));

  const art = hre.artifacts.readArtifactSync("TokenVendor");
  fs.writeFileSync(path.join(outDir, "TokenVendor.json"), JSON.stringify(art.abi, null, 2));

  console.log("\nMerged USDC / ZEN / TokenVendor into frontend/src/contracts/");
  console.log(JSON.stringify({ USDC: usdcAddr, ZEN: zenAddr, TokenVendor: vendorAddr }, null, 2));
  console.log("\nNext: `npm run fund` to give the vendor ETH for token->ETH swaps.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
