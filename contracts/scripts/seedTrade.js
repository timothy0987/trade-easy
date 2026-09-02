const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Seeds one agent position so the vault's `heldTokens()` is non-empty — this is
 * what makes the "Portfolio commitment" card render a real executionAccountsRoot.
 *
 * Does three things, all from the deployer key (which is owner AND agent):
 *   1. refresh AgentRegistry liveness (acceptAttestation + heartbeat)
 *   2. deposit vUSD into the vault if it has little/no capital
 *   3. executeTrade: vUSD -> mWETH via the venue adapter
 *
 *   npx hardhat run scripts/seedTrade.js --network horizenTestnet
 */
async function main() {
  const { ethers } = hre;
  const [signer] = await ethers.getSigners();
  const A = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../frontend/src/contracts/addresses.json"), "utf8")
  );

  console.log(`Network : ${hre.network.name}`);
  console.log(`Signer  : ${signer.address}`);
  console.log(`ETH     : ${ethers.formatEther(await ethers.provider.getBalance(signer.address))}\n`);

  const vault = await ethers.getContractAt("PrivateTradingVault", A.PrivateTradingVault, signer);
  const registry = await ethers.getContractAt("AgentRegistry", A.AgentRegistry, signer);
  const asset = await ethers.getContractAt("MockERC20", A.VaultAsset, signer);
  const adapter = A.TradeEasyVenueAdapter;
  const tokenOut = A.VaultTradableAsset;

  if (!adapter || !tokenOut) throw new Error("TradeEasyVenueAdapter / VaultTradableAsset missing from addresses.json");

  // ---- 1. agent liveness ------------------------------------------------
  console.log("1. Refreshing agent liveness…");
  try {
    const tx = await registry.acceptAttestation(
      ethers.keccak256(ethers.toUtf8Bytes("m1-stub-attestation")),
      "stub://m1-seed"
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

  // ---- 2. capital -----------------------------------------------------
  const dec = await asset.decimals();
  const nav = await vault.totalAssets();
  console.log(`2. Vault NAV: ${ethers.formatUnits(nav, dec)} vUSD`);
  if (nav < ethers.parseUnits("200", dec)) {
    const amt = ethers.parseUnits("1000", dec);
    console.log("   minting + depositing 1,000 vUSD…");
    await (await asset.mint(signer.address, amt)).wait();
    await (await asset.approve(A.PrivateTradingVault, amt)).wait();
    await (await vault.deposit(amt, signer.address)).wait();
    console.log(`   NAV now: ${ethers.formatUnits(await vault.totalAssets(), dec)} vUSD\n`);
  } else {
    console.log("   enough capital, skipping deposit\n");
  }

  // ---- 3. trade ------------------------------------------------------
  const amountIn = ethers.parseUnits("50", dec); // 50 vUSD — well under maxTradeBps and the seeded pool
  console.log(`3. executeTrade: 50 vUSD -> mWETH via ${adapter}`);
  const tx = await vault.executeTrade(
    adapter,
    A.VaultAsset,
    tokenOut,
    amountIn,
    0n,
    ethers.encodeBytes32String("m1-seed"),
    "0x"
  );
  const rcpt = await tx.wait();
  console.log(`   tx: ${rcpt.hash}`);

  const held = await vault.heldTokens();
  console.log(`\nheldTokens(): ${JSON.stringify(held)}`);
  console.log(`deployedValue(): ${ethers.formatUnits(await vault.deployedValue(), dec)} vUSD`);
  console.log("\nOpen /vault → Manager on the live site: the Portfolio commitment card now shows executionAccountsRoot.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
