const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Unwinds the vault's held position back into vUSD — the reverse of seedTrade.js.
 * Use this when liquid vUSD is short of `reservedAssets` (a processed redemption
 * can't be claimed because the payout is short). Sells the ENTIRE held-token
 * balance back through the venue adapter, refreshing agent liveness first.
 *
 *   npx hardhat run scripts/unwindTrade.js --network horizenTestnet
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
  const registry = await ethers.getContractAt("AgentRegistry", A.AgentRegistry, signer);
  const tokenIn = await ethers.getContractAt("MockERC20", A.VaultTradableAsset, signer);
  const adapter = A.TradeEasyVenueAdapter;

  if (!adapter || !A.VaultTradableAsset) throw new Error("TradeEasyVenueAdapter / VaultTradableAsset missing from addresses.json");

  // ---- 1. agent liveness ------------------------------------------------
  console.log("1. Refreshing agent liveness…");
  try {
    const tx = await registry.acceptAttestation(
      ethers.keccak256(ethers.toUtf8Bytes("unwind-attestation")),
      "stub://unwind"
    );
    await tx.wait();
    console.log("   acceptAttestation ok");
  } catch (e) {
    console.log(`   acceptAttestation skipped: ${(e.shortMessage || e.message || e).slice(0, 120)}`);
  }
  try {
    const tx = await registry.heartbeat();
    await tx.wait();
    console.log("   heartbeat ok");
  } catch (e) {
    console.log(`   heartbeat skipped: ${(e.shortMessage || e.message || e).slice(0, 120)}`);
  }
  console.log(`   isAgentLive: ${await registry.isAgentLive()}\n`);

  // ---- 2. sell the whole held-token balance back to vUSD ----------------
  const amountIn = await tokenIn.balanceOf(A.PrivateTradingVault);
  if (amountIn === 0n) {
    console.log("2. No held VaultTradableAsset balance — nothing to unwind.");
    return;
  }
  console.log(`2. executeTrade: ${ethers.formatUnits(amountIn, 18)} mWETH -> vUSD via ${adapter}`);
  const tx = await vault.executeTrade(
    adapter,
    A.VaultTradableAsset,
    A.VaultAsset,
    amountIn,
    0n,
    ethers.encodeBytes32String("unwind"),
    "0x"
  );
  const rcpt = await tx.wait();
  console.log(`   tx: ${rcpt.hash}`);

  const dec = 18;
  const liquid = await (await ethers.getContractAt("MockERC20", A.VaultAsset, signer)).balanceOf(A.PrivateTradingVault);
  const reserved = await vault.reservedAssets();
  console.log(`\nLiquid vUSD in vault : ${ethers.formatUnits(liquid, dec)}`);
  console.log(`reservedAssets       : ${ethers.formatUnits(reserved, dec)}`);
  console.log(`held tokens now      : ${JSON.stringify(await vault.heldTokens())}`);
  console.log(liquid >= reserved ? "\nLiquid balance now covers reservedAssets — claims should succeed." : "\nStill short — may need another unwind or a top-up deposit.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
