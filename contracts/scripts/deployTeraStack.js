const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploys the TERA trading stack to Horizen and funds it:
 *   TERA         plain 18-decimal ERC20 (open mint on testnet)
 *   USDC         mock 6-decimal ERC20   (open mint on testnet)
 *   TokenVendor  ETH <-> TERA/USDC + TERA<->USDC at a fixed rate (1 ETH = 100)
 *   TeraFaucet   100 TERA / 24h
 *
 *   npm run deploy:tera
 *
 * Merges the addresses + ABIs into frontend/src/contracts/addresses.json.
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const e = hre.ethers.parseEther;
  const outDir = path.join(__dirname, "../../frontend/src/contracts");
  const addrPath = path.join(outDir, "addresses.json");
  const addresses = fs.existsSync(addrPath) ? JSON.parse(fs.readFileSync(addrPath, "utf8")) : {};

  console.log(`Network : ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const deploy = async (name, args = []) => {
    const c = await (await hre.ethers.getContractFactory(name)).deploy(...args);
    await c.waitForDeployment();
    const a = await c.getAddress();
    console.log(`  ${name} -> ${a}`);
    return c;
  };

  console.log("Deploying tokens...");
  const tera = await deploy("TERA");
  // 18-decimal mock so TokenVendor's fixed-rate math stays consistent across ETH/TERA/USDC.
  const usdc = await deploy("MockERC20", ["USD Coin", "USDC", 18]);
  const teraAddr = await tera.getAddress();
  const usdcAddr = await usdc.getAddress();

  console.log("Deploying vendor + faucet...");
  const vendor = await deploy("TokenVendor", [teraAddr, usdcAddr]);
  const faucet = await deploy("TeraFaucet", [teraAddr]);
  const vendorAddr = await vendor.getAddress();
  const faucetAddr = await faucet.getAddress();

  console.log("Funding...");
  await (await tera.mint(faucetAddr, e("1000000"))).wait();          // 1M TERA -> faucet
  await (await tera.mint(vendorAddr, e("5000000"))).wait();          // 5M TERA -> vendor
  await (await usdc.mint(vendorAddr, e("5000000"))).wait();          // 5M USDC -> vendor
  await (await deployer.sendTransaction({ to: vendorAddr, value: e("0.003") })).wait(); // ETH for sell routes
  console.log("  faucet: 1,000,000 TERA");
  console.log("  vendor: 5,000,000 TERA + 5,000,000 USDC + 0.003 ETH");

  const merged = {
    ...addresses,
    TERA: teraAddr,
    USDC: usdcAddr,
    TokenVendor: vendorAddr,
    TeraFaucet: faucetAddr,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(addrPath, JSON.stringify(merged, null, 2));

  for (const [name, arte] of [
    ["TERA", "TERA"],
    ["TokenVendor", "TokenVendor"],
    ["TeraFaucet", "TeraFaucet"],
  ]) {
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(hre.artifacts.readArtifactSync(arte).abi, null, 2));
  }

  console.log("\nMerged TERA stack into frontend/src/contracts/");
  console.log(JSON.stringify({ TERA: teraAddr, USDC: usdcAddr, TokenVendor: vendorAddr, TeraFaucet: faucetAddr }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
