const { expect } = require("chai");
const { ethers } = require("hardhat");

const WAD = 10n ** 18n;

const ZERO_FEES = {
  managementFeeBps: 0,
  performanceFeeBps: 0,
  stakingFeeShareBps: 0,
  feeRecipient: ethers.ZeroAddress,
  stakingPool: ethers.ZeroAddress,
};

describe("PrivateTradingVault", () => {
  let owner, agent, alice, bob, manager, staking;
  let asset, weth, oracle, registry, vault, adapter, router, factory;

  beforeEach(async () => {
    [owner, agent, alice, bob, manager, staking] = await ethers.getSigners();

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
      },
      ZERO_FEES
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

  describe("fees", () => {
    let feeVault;
    const YEAR = 365 * 24 * 3600;

    beforeEach(async () => {
      feeVault = await (await ethers.getContractFactory("PrivateTradingVault")).deploy(
        await asset.getAddress(),
        "Fee Vault Share", "fVAULT",
        owner.address,
        await registry.getAddress(),
        await oracle.getAddress(),
        {
          maxTradeBps: 2000,
          maxDeployedBps: 8000,
          maxDrawdownBps: 1500,
          depositCap: ethers.parseEther("1000000"),
          emergencyGracePeriod: 6 * 3600,
        },
        {
          managementFeeBps: 200,       // 2% / year
          performanceFeeBps: 2000,     // 20% of profit
          stakingFeeShareBps: 1750,    // 17.5% of every fee -> staking pool
          feeRecipient: manager.address,
          stakingPool: staking.address,
        }
      );
      for (const u of [alice, bob]) {
        await asset.connect(u).approve(await feeVault.getAddress(), ethers.MaxUint256);
      }
    });

    it("rejects fee rates above the caps", async () => {
      await expect(feeVault.setFees(600, 2000, 1750)).to.be.revertedWithCustomError(feeVault, "FeeTooHigh");
      await expect(feeVault.setFees(200, 3100, 1750)).to.be.revertedWithCustomError(feeVault, "FeeTooHigh");
      await expect(feeVault.setFees(200, 2000, 10001)).to.be.revertedWithCustomError(feeVault, "FeeTooHigh");
    });

    it("accrues the management fee over time and splits it manager / staking", async () => {
      await feeVault.connect(alice).deposit(ethers.parseEther("10000"), alice.address);
      await ethers.provider.send("evm_increaseTime", [YEAR]);
      await ethers.provider.send("evm_mine", []);

      await feeVault.accrueFees();

      const mgr = await feeVault.balanceOf(manager.address);
      const stk = await feeVault.balanceOf(staking.address);
      const total = mgr + stk;
      // ~2% of 10k assets => ~204 fee shares (dilution)
      expect(total).to.be.closeTo(ethers.parseEther("204"), ethers.parseEther("3"));
      // staking gets 17.5%
      expect((stk * 10000n) / total).to.be.closeTo(1750n, 20n);
      // alice's shares now worth ~2% less
      expect(await feeVault.convertToAssets(await feeVault.balanceOf(alice.address)))
        .to.be.closeTo(ethers.parseEther("9800"), ethers.parseEther("5"));
    });

    it("charges the performance fee only on gains above the high-water mark", async () => {
      await feeVault.connect(alice).deposit(ethers.parseEther("10000"), alice.address);

      // simulate a +20% gain by donating asset into the vault
      await asset.mint(await feeVault.getAddress(), ethers.parseEther("2000"));
      expect(await feeVault.pricePerShare()).to.be.closeTo(ethers.parseEther("1.2"), ethers.parseEther("0.001"));

      await feeVault.accrueFees();

      const total = (await feeVault.balanceOf(manager.address)) + (await feeVault.balanceOf(staking.address));
      // 20% of the 2000 gain = 400 assets => ~345 fee shares against 12000 NAV
      expect(total).to.be.closeTo(ethers.parseEther("345"), ethers.parseEther("5"));
      const hwm1 = await feeVault.highWaterPricePerShare();
      expect(hwm1).to.be.gt(ethers.parseEther("1.15"));

      // second accrual with no further gain -> no *performance* fee recharged
      // (only a negligible management-fee sliver for the ~1s that elapsed)
      const totalBefore = await feeVault.totalSupply();
      await feeVault.accrueFees();
      const minted2 = (await feeVault.totalSupply()) - totalBefore;
      expect(minted2).to.be.lt(ethers.parseEther("0.001"));
      expect(await feeVault.highWaterPricePerShare()).to.equal(hwm1);
    });

    it("freezes fee accrual during emergency", async () => {
      await feeVault.connect(alice).deposit(ethers.parseEther("10000"), alice.address);
      await ethers.provider.send("evm_increaseTime", [24 * 3600 + 6 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);
      await feeVault.connect(bob).declareEmergency();

      const supplyBefore = await feeVault.totalSupply();
      await ethers.provider.send("evm_increaseTime", [YEAR]);
      await ethers.provider.send("evm_mine", []);
      await feeVault.accrueFees();
      expect(await feeVault.totalSupply()).to.equal(supplyBefore);
    });

    it("previewAccruedFeeShares matches what accrueFees mints", async () => {
      await feeVault.connect(alice).deposit(ethers.parseEther("10000"), alice.address);
      await ethers.provider.send("evm_increaseTime", [YEAR / 2]);
      await ethers.provider.send("evm_mine", []);

      const preview = await feeVault.previewAccruedFeeShares();
      const supplyBefore = await feeVault.totalSupply();
      await feeVault.accrueFees();
      const minted = (await feeVault.totalSupply()) - supplyBefore;
      expect(minted).to.be.closeTo(preview, preview / 1000n + 1n);
    });
  });
});
