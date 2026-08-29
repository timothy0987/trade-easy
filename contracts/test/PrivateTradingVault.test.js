const { expect } = require("chai");
const { ethers } = require("hardhat");

const WAD = 10n ** 18n;

describe("PrivateTradingVault", () => {
  let owner, agent, alice, bob;
  let asset, weth, oracle, registry, vault, adapter, router, factory;

  beforeEach(async () => {
    [owner, agent, alice, bob] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    asset = await MockERC20.deploy("Vault USD", "vUSD", 18);
    weth = await MockERC20.deploy("Mock WETH", "mWETH", 18);

    // main's Router takes (factory, WETH). Token-token swaps never touch WETH, so any
    // ERC20 address works as the sentinel here.
    const wethSentinel = await MockERC20.deploy("Wrapped ETH", "WETH", 18);
    factory = await (await ethers.getContractFactory("TradeEasyFactory")).deploy();
    router = await (await ethers.getContractFactory("TradeEasyRouter")).deploy(
      await factory.getAddress(),
      await wethSentinel.getAddress()
    );
    adapter = await (await ethers.getContractFactory("TradeEasyVenueAdapter")).deploy(await router.getAddress());

    // seed AMM pool 100k vUSD : 50 mWETH  => 2000 vUSD/mWETH
    const aAmt = ethers.parseEther("100000");
    const wAmt = ethers.parseEther("50");
    await asset.mint(owner.address, aAmt);
    await weth.mint(owner.address, wAmt);
    await asset.approve(await router.getAddress(), aAmt);
    await weth.approve(await router.getAddress(), wAmt);
    await router.addLiquidity(
      await asset.getAddress(), await weth.getAddress(),
      aAmt, wAmt, 0, 0, owner.address,
      Math.floor(Date.now() / 1000) + 600
    );

    oracle = await (await ethers.getContractFactory("MockOracle")).deploy(owner.address);
    await oracle.setPrice(await asset.getAddress(), WAD);
    await oracle.setPrice(await weth.getAddress(), ethers.parseEther("2000"));

    registry = await (await ethers.getContractFactory("AgentRegistry")).deploy(
      owner.address, agent.address, 24 * 3600, 15 * 60, 48 * 3600
    );

    vault = await (await ethers.getContractFactory("PrivateTradingVault")).deploy(
      await asset.getAddress(),
      "Private Trading Vault Share", "ptVAULT",
      owner.address,
      await registry.getAddress(),
      await oracle.getAddress(),
      {
        maxTradeBps: 2000,
        maxDeployedBps: 8000,
        maxDrawdownBps: 1500,
        depositCap: ethers.parseEther("1000000"),
        emergencyGracePeriod: 6 * 3600,
      }
    );

    await vault.setAllowedVenue(await adapter.getAddress(), true);
    await vault.setAllowedToken(await weth.getAddress(), true);

    for (const u of [alice, bob]) {
      await asset.mint(u.address, ethers.parseEther("50000"));
      await asset.connect(u).approve(await vault.getAddress(), ethers.MaxUint256);
    }
  });

  it("mints 1:1 shares on first deposit and tracks NAV", async () => {
    await vault.connect(alice).deposit(ethers.parseEther("10000"), alice.address);
    expect(await vault.balanceOf(alice.address)).to.equal(ethers.parseEther("10000"));
    expect(await vault.totalAssets()).to.equal(ethers.parseEther("10000"));
    expect(await vault.pricePerShare()).to.equal(WAD);
  });

  it("lets only the live agent trade, within the mandate", async () => {
    await vault.connect(alice).deposit(ethers.parseEther("10000"), alice.address);

    // non-agent blocked
    await expect(
      vault.connect(bob).executeTrade(
        await adapter.getAddress(), await asset.getAddress(), await weth.getAddress(),
        ethers.parseEther("1000"), 0, ethers.id("t"), "0x"
      )
    ).to.be.revertedWithCustomError(vault, "NotAgent");

    // over per-trade cap (20% of 10k = 2k) blocked
    await expect(
      vault.connect(agent).executeTrade(
        await adapter.getAddress(), await asset.getAddress(), await weth.getAddress(),
        ethers.parseEther("3000"), 0, ethers.id("t"), "0x"
      )
    ).to.be.revertedWithCustomError(vault, "TradeTooLarge");

    // valid trade: 1500 vUSD -> mWETH
    await vault.connect(agent).executeTrade(
      await adapter.getAddress(), await asset.getAddress(), await weth.getAddress(),
      ethers.parseEther("1500"), 0, ethers.id("momentum"), "0x"
    );
    const held = await vault.heldTokens();
    expect(held).to.include(await weth.getAddress());
    // NAV roughly preserved (AMM fee + slippage < 1%)
    const nav = await vault.totalAssets();
    expect(nav).to.be.gt(ethers.parseEther("9900"));
    expect(nav).to.be.lt(ethers.parseEther("10001"));
  });

  it("blocks trades when the agent attestation is stale", async () => {
    await vault.connect(alice).deposit(ethers.parseEther("10000"), alice.address);
    await ethers.provider.send("evm_increaseTime", [25 * 3600]);
    await ethers.provider.send("evm_mine", []);
    expect(await registry.isAgentLive()).to.equal(false);
    await expect(
      vault.connect(agent).executeTrade(
        await adapter.getAddress(), await asset.getAddress(), await weth.getAddress(),
        ethers.parseEther("1000"), 0, ethers.id("t"), "0x"
      )
    ).to.be.revertedWithCustomError(vault, "AgentNotLive");
  });

  it("trips unwind-only after a drawdown breach", async () => {
    await vault.connect(alice).deposit(ethers.parseEther("10000"), alice.address);
    // deploy ~45% of NAV into mWETH across 3 mandate-sized trades
    for (let i = 0; i < 3; i++) {
      await vault.connect(agent).executeTrade(
        await adapter.getAddress(), await asset.getAddress(), await weth.getAddress(),
        ethers.parseEther("1500"), 0, ethers.id("t"), "0x"
      );
    }
    // crash mWETH price 50% -> ~22% portfolio drawdown, past the 15% limit
    await oracle.setPrice(await weth.getAddress(), ethers.parseEther("1000"));
    // any trade re-evaluates drawdown; a tiny unwind triggers the check
    await vault.connect(agent).executeTrade(
      await adapter.getAddress(), await weth.getAddress(), await asset.getAddress(),
      ethers.parseEther("0.01"), 0, ethers.id("t"), "0x"
    );
    expect(await vault.unwindOnly()).to.equal(true);

    // opening trades now blocked
    await expect(
      vault.connect(agent).executeTrade(
        await adapter.getAddress(), await asset.getAddress(), await weth.getAddress(),
        ethers.parseEther("100"), 0, ethers.id("t"), "0x"
      )
    ).to.be.revertedWithCustomError(vault, "UnwindOnlyActive");
  });

  it("queues redemptions that exceed idle liquidity, then pays them out", async () => {
    await vault.connect(alice).deposit(ethers.parseEther("10000"), alice.address);
    // deploy ~45% so idle can't cover a full exit
    for (let i = 0; i < 3; i++) {
      await vault.connect(agent).executeTrade(
        await adapter.getAddress(), await asset.getAddress(), await weth.getAddress(),
        ethers.parseEther("1500"), 0, ethers.id("t"), "0x"
      );
    }

    const shares = await vault.balanceOf(alice.address);
    await expect(
      vault.connect(alice).redeem(shares, alice.address, alice.address)
    ).to.be.revertedWithCustomError(vault, "UseRedemptionQueue");

    await vault.connect(alice).approve(await vault.getAddress(), shares);
    await vault.connect(alice).requestRedeem(shares);

    // agent unwinds back to asset in mandate-sized chunks
    for (let i = 0; i < 10; i++) {
      const bal = await weth.balanceOf(await vault.getAddress());
      if (bal === 0n) break;
      const chunk = bal < ethers.parseEther("0.6") ? bal : ethers.parseEther("0.6");
      await vault.connect(agent).executeTrade(
        await adapter.getAddress(), await weth.getAddress(), await asset.getAddress(),
        chunk, 0, ethers.id("unwind"), "0x"
      );
    }

    await vault.connect(owner).processRedeemRequests([0]);
    const before = await asset.balanceOf(alice.address);
    await vault.connect(alice).claimRedeem(0);
    const gained = (await asset.balanceOf(alice.address)) - before;
    expect(gained).to.be.gt(ethers.parseEther("9800")); // ~10k minus AMM round-trip fees
  });

  it("opens permissionless emergency redemptions when the agent is long dead", async () => {
    await vault.connect(alice).deposit(ethers.parseEther("10000"), alice.address);
    await vault.connect(bob).deposit(ethers.parseEther("10000"), bob.address);

    await ethers.provider.send("evm_increaseTime", [24 * 3600 + 6 * 3600 + 1]);
    await ethers.provider.send("evm_mine", []);

    await vault.connect(bob).declareEmergency();
    expect(await vault.emergency()).to.equal(true);

    const aliceShares = await vault.balanceOf(alice.address);
    const before = await asset.balanceOf(alice.address);
    await vault.connect(alice).emergencyRedeem(aliceShares);
    const gained = (await asset.balanceOf(alice.address)) - before;
    // ~half the idle pool (alice holds half the shares), all assets are idle here
    expect(gained).to.be.gt(ethers.parseEther("9900"));
  });
});
