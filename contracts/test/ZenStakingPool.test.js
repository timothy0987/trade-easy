const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZenStakingPool", () => {
  let owner, alice, bob, vault;
  let zen, reward, pool;

  beforeEach(async () => {
    [owner, alice, bob, vault] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    zen = await MockERC20.deploy("Test ZEN", "tZEN", 18);
    reward = await MockERC20.deploy("Vault Share", "ptVAULT", 18); // stands in for the vault
    pool = await (await ethers.getContractFactory("ZenStakingPool")).deploy(
      await zen.getAddress(),
      await reward.getAddress(),
      owner.address
    );

    for (const u of [alice, bob]) {
      await zen.mint(u.address, ethers.parseEther("1000"));
      await zen.connect(u).approve(await pool.getAddress(), ethers.MaxUint256);
    }
    // `vault` signer mints reward tokens to itself to simulate fee-share transfers
    await reward.mint(vault.address, ethers.parseEther("10000"));
  });

  const sendReward = (amt) => reward.connect(vault).transfer(pool.target, ethers.parseEther(amt));

  it("splits a reward pro-rata by stake", async () => {
    await pool.connect(alice).stake(ethers.parseEther("300"));
    await pool.connect(bob).stake(ethers.parseEther("100")); // 75% / 25%

    await sendReward("400");

    expect(await pool.pendingReward(alice.address)).to.be.closeTo(ethers.parseEther("300"), ethers.parseEther("0.001"));
    expect(await pool.pendingReward(bob.address)).to.be.closeTo(ethers.parseEther("100"), ethers.parseEther("0.001"));

    const a0 = await reward.balanceOf(alice.address);
    await pool.connect(alice).claim();
    expect((await reward.balanceOf(alice.address)) - a0).to.be.closeTo(ethers.parseEther("300"), ethers.parseEther("0.001"));
    expect(await pool.pendingReward(alice.address)).to.equal(0);
  });

  it("does not credit a staker for rewards that arrived before they staked", async () => {
    await pool.connect(alice).stake(ethers.parseEther("100"));
    await sendReward("100"); // all alice's

    await pool.connect(bob).stake(ethers.parseEther("100"));
    expect(await pool.pendingReward(bob.address)).to.equal(0);
    expect(await pool.pendingReward(alice.address)).to.be.closeTo(ethers.parseEther("100"), ethers.parseEther("0.001"));

    await sendReward("100"); // now 50/50
    expect(await pool.pendingReward(alice.address)).to.be.closeTo(ethers.parseEther("150"), ethers.parseEther("0.001"));
    expect(await pool.pendingReward(bob.address)).to.be.closeTo(ethers.parseEther("50"), ethers.parseEther("0.001"));
  });

  it("holds reward that arrives with nothing staked, then pays the first staker", async () => {
    await sendReward("500"); // nobody staked
    expect(await pool.unaccountedReward()).to.equal(ethers.parseEther("500"));

    await pool.connect(alice).stake(ethers.parseEther("100"));
    // sync happens on next interaction; a tiny self-claim triggers it
    await pool.connect(alice).claim();
    expect(await pool.pendingReward(alice.address)).to.equal(0);
    expect(await reward.balanceOf(alice.address)).to.be.closeTo(ethers.parseEther("500"), ethers.parseEther("0.001"));
  });

  it("pays out on unstake and exit", async () => {
    await pool.connect(alice).stake(ethers.parseEther("200"));
    await sendReward("200");

    const z0 = await zen.balanceOf(alice.address);
    const r0 = await reward.balanceOf(alice.address);
    await pool.connect(alice).exit();
    expect((await zen.balanceOf(alice.address)) - z0).to.equal(ethers.parseEther("200"));
    expect((await reward.balanceOf(alice.address)) - r0).to.be.closeTo(ethers.parseEther("200"), ethers.parseEther("0.001"));
    expect(await pool.stakedOf(alice.address)).to.equal(0);
    expect(await pool.totalStaked()).to.equal(0);
  });

  it("blocks rescuing the staking or reward token", async () => {
    await expect(pool.rescue(await zen.getAddress(), owner.address, 1)).to.be.revertedWith("protected token");
    await expect(pool.rescue(await reward.getAddress(), owner.address, 1)).to.be.revertedWith("protected token");
  });
});
