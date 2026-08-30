const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Adds ZEN as a real swap pair.
 *
 *   npm run deploy:zenswap
 *
 * - Deploys MockERC20 "Horizen ZEN" (ZEN, 18d, open mint) — the existing tZEN
 *   at 0x7Bb00ada… has an owner-only mint, so we can't fund a vendor with it.
 * - Deploys the new generic TokenVendor(owner, rate=100, [TERA, USDC, ZEN]).
 * - Mints 5M each of TERA / USDC / ZEN into the vendor treasury.
 * - Merges ZEN + the new TokenVendor address (and ABI) into addresses.json.
 *
 * Run `npm run fund` afterwards to give the new vendor ETH for token->ETH swaps.
 * Existing TeraFaucet is untouched.
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const outDir = path.join(__dirname, "../../frontend/src/contracts");
  const addrPath = path.join(outDir, "addresses.json");
  const A = JSON.parse(fs.readFileSync(addrPath, "utf8"));

  if (!A.TERA || !A.USDC) throw new Error("TERA / USDC missing from addresses.json — run deploy:tera first");
  console.log(`Network : ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const deploy = async (name, args = []) => {
    const c = await (await hre.ethers.getContractFactory(name)).deploy(...args);
    await c.waitForDeployment();
    const a = await c.getAddress();
    console.log(`  ${name} -> ${a}`);
    return c;
  };

  console.log("Deploying ZEN mock + generic TokenVendor...");
  const zen = await deploy("MockERC20", ["Horizen ZEN", "ZEN", 18]);
  const zenAddr = await zen.getAddress();

  const vendor = await deploy("TokenVendor", [deployer.address, 100n, [A.TERA, A.USDC, zenAddr]]);
  const vendorAddr = await vendor.getAddress();

  console.log("Seeding vendor treasury (5M TERA / USDC / ZEN)...");
  const amt = hre.ethers.parseEther("5000000");
  const tera = await hre.ethers.getContractAt(["function mint(address,uint256)"], A.TERA);
  const usdc = await hre.ethers.getContractAt(["function mint(address,uint256)"], A.USDC);
  await (await tera.mint(vendorAddr, amt)).wait();
  await (await usdc.mint(vendorAddr, amt)).wait();
  await (await zen.mint(vendorAddr, amt)).wait();

  // Persist
  A.ZEN = zenAddr;
  A.TokenVendor = vendorAddr;
  A._zenNote =
    "Horizen ZEN — our own MockERC20 (18d, open mint) so the vendor + users can hold it. " +
    "The prior third-party tZEN (0x7Bb00ada…) had an owner-only mint. Point ZEN at Horizen's " +
    "canonical token once published.";
  A.timestamp = new Date().toISOString();
  fs.writeFileSync(addrPath, JSON.stringify(A, null, 2));

  const art = hre.artifacts.readArtifactSync("TokenVendor");
  fs.writeFileSync(path.join(outDir, "TokenVendor.json"), JSON.stringify(art.abi, null, 2));

  console.log("\nMerged ZEN + new TokenVendor into frontend/src/contracts/");
  console.log(JSON.stringify({ ZEN: zenAddr, TokenVendor: vendorAddr }, null, 2));
  console.log("\nNext: `npm run fund` to give the vendor ETH for token->ETH swaps.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
