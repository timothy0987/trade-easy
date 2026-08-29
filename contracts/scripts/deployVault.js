const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploys the Private Trading Vault stack to Horizen and MERGES the addresses into
 * frontend/src/contracts/addresses.json (keeps TERA / USDC / vendor entries intact).
 *
 *   TradeEasyFactory + TradeEasyRouter   local constant-product AMM (the M1 trading venue)
 *   TradeEasyVenueAdapter                ITradeVenue wrapper the vault calls
 *   MockOracle                           NAV oracle (TESTNET ONLY - replace with a TWAP feed)
 *   AgentRegistry                        agent key + TEE attestation liveness gate
 *   PrivateTradingVault                  ERC-4626 vault, agent-mandated
 *
 * Env: PRIVATE_KEY (deployer/governance), AGENT_ADDRESS (enclave key; defaults to deployer),
 *      VAULT_ASSET (existing ERC20 to use as the vault asset; skips the mock on mainnet).
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const net = hre.network.name;
  const isTestnet = net !== "horizenMainnet";
  const agentAddress = process.env.AGENT_ADDRESS || deployer.address;

  console.log(`Network: ${net}`);
  console.log(`Deployer / governance: ${deployer.address}`);
  console.log(`Agent key: ${agentAddress}`);

  const deploy = async (name, args = []) => {
    const F = await hre.ethers.getContractFactory(name);
    const c = await F.deploy(...args);
    await c.waitForDeployment();
    const addr = await c.getAddress();
    console.log(`  ${name} -> ${addr}`);
    return c;
  };

  const outDir = path.join(__dirname, "../../frontend/src/contracts");
  const addrPath = path.join(outDir, "addresses.json");
  let addresses = {};
  if (fs.existsSync(addrPath)) addresses = JSON.parse(fs.readFileSync(addrPath, "utf8"));

  // 1. AMM venue (main's Router constructor is (factory, WETH))
  console.log("Deploying AMM venue...");
  const weth = addresses.WETH
    ? { getAddress: async () => addresses.WETH }
    : await deploy("MockERC20", ["Wrapped ETH", "WETH", 18]);
  const factory = await deploy("TradeEasyFactory");
  const router = await deploy("TradeEasyRouter", [await factory.getAddress(), await weth.getAddress()]);
  const adapter = await deploy("TradeEasyVenueAdapter", [await router.getAddress()]);

  // 2. Vault asset + a tradable asset (mock on testnet)
  let assetAddr = process.env.VAULT_ASSET;
  let tradableAddr;
  if (!assetAddr) {
    if (!isTestnet) throw new Error("VAULT_ASSET must be set for mainnet");
    console.log("Deploying mock tokens...");
    const asset = await deploy("MockERC20", ["Vault USD", "vUSD", 18]);
    const tradable = await deploy("MockERC20", ["Mock WETH", "mWETH", 18]);
    assetAddr = await asset.getAddress();
    tradableAddr = await tradable.getAddress();

    const amtAsset = hre.ethers.parseEther("100000");
    const amtTradable = hre.ethers.parseEther("50");
    await (await asset.mint(deployer.address, amtAsset)).wait();
    await (await tradable.mint(deployer.address, amtTradable)).wait();
    await (await asset.approve(await router.getAddress(), amtAsset)).wait();
    await (await tradable.approve(await router.getAddress(), amtTradable)).wait();
    await (
      await router.addLiquidity(
        assetAddr, tradableAddr, amtAsset, amtTradable, 0, 0, deployer.address,
        Math.floor(Date.now() / 1000) + 600
      )
    ).wait();
    console.log("  Seeded vUSD/mWETH pool (~2000 vUSD/mWETH)");
  }

  // 3. Oracle (TESTNET MOCK — swap for a TWAP feed before real funds)
  console.log("Deploying oracle...");
  const oracle = await deploy("MockOracle", [deployer.address]);
  if (tradableAddr) {
    await (await oracle.setPrice(assetAddr, hre.ethers.parseEther("1"))).wait();
    await (await oracle.setPrice(tradableAddr, hre.ethers.parseEther("2000"))).wait();
  }

  // 4. Agent registry
  console.log("Deploying AgentRegistry...");
  const registry = await deploy("AgentRegistry", [
    deployer.address, // owner / governance
    agentAddress,     // agent key
    24 * 60 * 60,     // attestation validity: 24h
    15 * 60,          // heartbeat timeout: 15m
    2 * 24 * 60 * 60, // rotation timelock: 48h
  ]);

  // 5. Vault
  console.log("Deploying PrivateTradingVault...");
  const mandate = {
    maxTradeBps: 2000,
    maxDeployedBps: 8000,
    maxDrawdownBps: 1500,
    depositCap: hre.ethers.parseEther("1000000"),
    emergencyGracePeriod: 6 * 60 * 60,
  };
  const vault = await deploy("PrivateTradingVault", [
    assetAddr,
    "Private Trading Vault Share",
    "ptVAULT",
    deployer.address,
    await registry.getAddress(),
    await oracle.getAddress(),
    mandate,
  ]);

  // 6. Wire the mandate
  console.log("Configuring mandate...");
  await (await vault.setAllowedVenue(await adapter.getAddress(), true)).wait();
  if (tradableAddr) await (await vault.setAllowedToken(tradableAddr, true)).wait();

  // 7. Persist (merge) addresses + ABIs
  addresses = {
    ...addresses,
    network: net,
    chainId: hre.network.config.chainId,
    PrivateTradingVault: await vault.getAddress(),
    AgentRegistry: await registry.getAddress(),
    VaultOracle: await oracle.getAddress(),
    VaultFactory: await factory.getAddress(),
    VaultRouter: await router.getAddress(),
    TradeEasyVenueAdapter: await adapter.getAddress(),
    VaultAsset: assetAddr,
    VaultTradableAsset: tradableAddr || null,
    vaultAgent: agentAddress,
    timestamp: new Date().toISOString(),
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(addrPath, JSON.stringify(addresses, null, 2));

  for (const name of ["PrivateTradingVault", "AgentRegistry"]) {
    const art = hre.artifacts.readArtifactSync(name);
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(art.abi, null, 2));
  }

  console.log("\nMerged vault addresses + ABIs into frontend/src/contracts/addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
