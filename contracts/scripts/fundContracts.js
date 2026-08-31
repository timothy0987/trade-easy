const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Tops up the TokenVendor with ETH so token->ETH swaps can pay out.
 *
 *   npm run fund
 *
 * The vendor already holds 5M USDC + 5M ZEN for buys/swaps; the only gap is ETH.
 * A plain ETH send lands in its receive() and stays.
 *
 * Env:
 *   FUND_VENDOR_ETH   default "0.05"   ETH to add to the vendor
 */
async function main() {
  const [signer] = await hre.ethers.getSigners();
  const addrPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
  const A = JSON.parse(fs.readFileSync(addrPath, "utf8"));
  const e = hre.ethers.formatEther;

  const vendor = A.TokenVendor;
  if (!vendor) throw new Error("TokenVendor missing from addresses.json — run deploy:venue first");

  let vendorEth = hre.ethers.parseEther(process.env.FUND_VENDOR_ETH || "0.05");
  const gasBuffer = hre.ethers.parseEther("0.0006"); // L3 gas is tiny; keep a small cushion
  const bal = await hre.ethers.provider.getBalance(signer.address);
  console.log(`Signer ${signer.address}  ETH ${e(bal)}`);

  if (bal <= gasBuffer) {
    throw new Error(`Only ${e(bal)} ETH — bridge more to ${signer.address} at https://hub-testnet.horizen.io`);
  }
  if (vendorEth + gasBuffer > bal) {
    vendorEth = bal - gasBuffer;
    console.log(`  capped to ${e(vendorEth)} ETH (all that's spendable after gas)`);
  }

  console.log(`\nFunding TokenVendor with ${e(vendorEth)} ETH...`);
  const before = await hre.ethers.provider.getBalance(vendor);
  await (await signer.sendTransaction({ to: vendor, value: vendorEth })).wait();
  const after = await hre.ethers.provider.getBalance(vendor);
  console.log(`  vendor ETH ${e(before)} -> ${e(after)}`);
  console.log(`\ntoken->ETH swaps now cover up to ${(Number(e(after)) * 100).toFixed(2)} tokens per trade.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
