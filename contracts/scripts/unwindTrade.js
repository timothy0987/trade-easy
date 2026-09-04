const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Unwinds the vault's held position back into vUSD — the reverse of seedTrade.js.
 * Use this when liquid vUSD is short of `reservedAssets` (a processed redemption
 * can't be claimed because the payout is short). Sells the ENTIRE held-token
 * balance back through the venue adapter, refreshing agent liveness first.
 *
 * totalAssets() excludes reservedAssets, so NAV (and the maxTradeBps cap derived
 * from it) can be near-zero while a large redemption is pending — even a small
 * position can then exceed the per-trade cap. If so, this temporarily raises
 * maxTradeBps (onlyOwner) just enough to cover the one unwind trade, then
 * restores the original limit immediately after (success or failure).
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
  const oracle = await ethers.getContractAt(
    ["function valueInAsset(address,uint256) view returns (uint256)"],
    await vault.oracle(),
    signer
  );
  const tokenIn = await ethers.getContractAt("MockERC20", A.VaultTradableAsset, signer);
  const adapter = A.TradeEasyVenueAdapter;
  const BPS = 10000n;

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

  // The per-trade cap is `maxTradeBps` of totalAssets(), and totalAssets() excludes
  // reservedAssets. With a large pending redemption reserved, NAV (and so the cap)
  // can be near-zero even though the position itself is a small % of the real vault.
  // Temporarily raise maxTradeBps just enough to cover this one trade, then restore it.
  const nav = await vault.totalAssets();
  const valueIn = await oracle.valueInAsset(A.VaultTradableAsset, amountIn);
  const currentCap = (nav * (await vault.maxTradeBps())) / BPS;
  const origMaxTradeBps = await vault.maxTradeBps();
  const origMaxDeployedBps = await vault.maxDeployedBps();
  const origMaxDrawdownBps = await vault.maxDrawdownBps();
  let raised = false;

  if (valueIn > currentCap) {
    const neededBps = nav === 0n ? BPS : (valueIn * BPS) / nav + 1n; // round up, +1 buffer
    const tempBps = neededBps > BPS ? BPS : neededBps;
    console.log(`   trade (${ethers.formatUnits(valueIn, 18)}) exceeds current cap (${ethers.formatUnits(currentCap, 18)}) — `
      + `raising maxTradeBps ${origMaxTradeBps} -> ${tempBps} for this trade`);
    await (await vault.setMandateLimits(tempBps, origMaxDeployedBps, origMaxDrawdownBps)).wait();
    raised = true;
  }

  try {
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
  } finally {
    if (raised) {
      console.log(`   restoring maxTradeBps -> ${origMaxTradeBps}`);
      await (await vault.setMandateLimits(origMaxTradeBps, origMaxDeployedBps, origMaxDrawdownBps)).wait();
    }
  }

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
