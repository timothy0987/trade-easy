const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Closes a liquidity shortfall (liquid vUSD < reservedAssets) by minting mock
 * vUSD and sending it DIRECTLY to the vault via plain ERC20 transfer — not
 * vault.deposit(), so it mints no new shares and dilutes nobody. This is only
 * possible because VaultAsset is an openly-mintable testnet mock.
 *
 * Use this when unwindTrade.js can't clear the shortfall on its own: with a
 * large pending redemption reserved, totalAssets() (and so the maxTradeBps
 * cap, which tops out at 100% = nav) can be smaller than the position being
 * unwound, so no amount of raising maxTradeBps can let that trade through.
 * Topping up liquidity first sidesteps the cap entirely.
 *
 *   npx hardhat run scripts/topUpLiquidity.js --network horizenTestnet
 */
async function main() {
  const { ethers } = hre;
  const [signer] = await ethers.getSigners();
  const A = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../frontend/src/contracts/addresses.json"), "utf8")
  );

  console.log(`Network : ${hre.network.name}`);
  console.log(`Signer  : ${signer.address}\n`);

  const vault = await ethers.getContractAt("PrivateTradingVault", A.PrivateTradingVault, signer);
  const asset = await ethers.getContractAt("MockERC20", A.VaultAsset, signer);

  const liquid = await asset.balanceOf(A.PrivateTradingVault);
  const reserved = await vault.reservedAssets();
  console.log(`Liquid vUSD in vault : ${ethers.formatUnits(liquid, 18)}`);
  console.log(`reservedAssets       : ${ethers.formatUnits(reserved, 18)}`);

  if (liquid >= reserved) {
    console.log("\nAlready sufficient — nothing to top up.");
    return;
  }

  const shortfall = reserved - liquid;
  const buffer = ethers.parseUnits("5", 18); // small cushion so this doesn't need re-running for dust/rounding
  const amount = shortfall + buffer;
  console.log(`Shortfall            : ${ethers.formatUnits(shortfall, 18)}`);
  console.log(`\nMinting + sending ${ethers.formatUnits(amount, 18)} vUSD directly to the vault…`);

  await (await asset.mint(signer.address, amount)).wait();
  const tx = await asset.transfer(A.PrivateTradingVault, amount);
  const rcpt = await tx.wait();
  console.log(`tx: ${rcpt.hash}`);

  const liquidAfter = await asset.balanceOf(A.PrivateTradingVault);
  const reservedAfter = await vault.reservedAssets();
  console.log(`\nLiquid vUSD in vault : ${ethers.formatUnits(liquidAfter, 18)}`);
  console.log(`reservedAssets       : ${ethers.formatUnits(reservedAfter, 18)}`);
  console.log(liquidAfter >= reservedAfter ? "Sufficient now — claims should succeed." : "Still short — run again.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
