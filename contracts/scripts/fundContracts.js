const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Tops up the user-facing contracts on Horizen testnet so swap + faucet work end to end.
 *
 *   npm run fund
 *
 * What it does (run by the deployer / owner):
 *   - TokenVendor  <- ETH   so sellTera / sellUsdc can pay out (this is the one real gap;
 *                           the vendor already holds 5M TERA + 5M USDC for buys/swaps).
 *                           A plain ETH send hits receive()->buyTokens(), which keeps the
 *                           ETH and returns a trivial amount of TERA to the sender.
 *   - TeraFaucet   <- TERA  only if it has dropped below FAUCET_MIN.
 *
 * Env (all optional):
 *   FUND_VENDOR_ETH   default "0.05"      ETH to add to the vendor
 *   FAUCET_MIN        default "100000"    refill the faucet if below this many TERA
 *   FAUCET_TOPUP      default "500000"    TERA to send when refilling
 */
async function main() {
  const [signer] = await hre.ethers.getSigners();
  const addrPath = path.join(__dirname, "../../frontend/src/contracts/addresses.json");
  const A = JSON.parse(fs.readFileSync(addrPath, "utf8"));
  const e = hre.ethers.formatEther;

  const vendor = A.TokenVendor;
  const faucet = A.TeraFaucet;
  if (!vendor) throw new Error("TokenVendor missing from addresses.json");

  const vendorEth = hre.ethers.parseEther(process.env.FUND_VENDOR_ETH || "0.05");
  const faucetMin = hre.ethers.parseEther(process.env.FAUCET_MIN || "100000");
  const faucetTopup = hre.ethers.parseEther(process.env.FAUCET_TOPUP || "500000");

  const bal = await hre.ethers.provider.getBalance(signer.address);
  console.log(`Signer ${signer.address}  ETH ${e(bal)}`);
  if (bal < vendorEth + hre.ethers.parseEther("0.005")) {
    throw new Error(
      `Not enough ETH. Need ~${e(vendorEth + hre.ethers.parseEther("0.005"))} (fund + gas). ` +
        `Bridge more to ${signer.address} at https://hub-testnet.horizen.io`
    );
  }

  // 1. Vendor ETH liquidity for sells
  console.log(`\nFunding TokenVendor with ${e(vendorEth)} ETH...`);
  const before = await hre.ethers.provider.getBalance(vendor);
  await (await signer.sendTransaction({ to: vendor, value: vendorEth })).wait();
  const after = await hre.ethers.provider.getBalance(vendor);
  console.log(`  vendor ETH ${e(before)} -> ${e(after)}`);

  // 2. Faucet TERA (only if low)
  if (faucet && A.TERA) {
    const tera = await hre.ethers.getContractAt(
      ["function balanceOf(address) view returns (uint256)", "function transfer(address,uint256) returns (bool)"],
      A.TERA
    );
    const fb = await tera.balanceOf(faucet);
    console.log(`\nTeraFaucet TERA balance: ${e(fb)}`);
    if (fb < faucetMin) {
      console.log(`  below ${e(faucetMin)} -> sending ${e(faucetTopup)} TERA...`);
      await (await tera.transfer(faucet, faucetTopup)).wait();
      console.log(`  new balance: ${e(await tera.balanceOf(faucet))}`);
    } else {
      console.log("  healthy, no top-up needed");
    }
  }

  // 3. Report
  console.log("\n--- balances now ---");
  const erc = await hre.ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], A.TERA);
  const usd = A.USDC ? await hre.ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], A.USDC) : null;
  const rows = { TokenVendor: vendor, TeraFaucet: faucet };
  for (const [name, addr] of Object.entries(rows)) {
    if (!addr) continue;
    const eth = e(await hre.ethers.provider.getBalance(addr));
    const t = e(await erc.balanceOf(addr));
    const u = usd ? e(await usd.balanceOf(addr)) : "-";
    console.log(`${name.padEnd(12)} ETH ${eth.padEnd(10)} TERA ${t.padEnd(14)} USDC ${u}`);
  }
  console.log("\nSell routes need the vendor to hold >= (amount / 100) ETH.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
