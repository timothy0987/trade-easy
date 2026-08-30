const { expect } = require("chai");
const { ethers } = require("hardhat");

const E = (n) => ethers.parseEther(String(n));
const ZERO = ethers.ZeroAddress;

describe("TokenVendor (generic fixed-rate)", () => {
  let owner, user;
  let tera, usdc, zen, vendor;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    const M = await ethers.getContractFactory("MockERC20");
    tera = await M.deploy("Trade Easy Token", "TERA", 18);
    usdc = await M.deploy("USD Coin", "USDC", 18);
    zen = await M.deploy("Horizen ZEN", "ZEN", 18);

    vendor = await (await ethers.getContractFactory("TokenVendor")).deploy(
      owner.address,
      100n,
      [await tera.getAddress(), await usdc.getAddress(), await zen.getAddress()]
    );

    // fund the vendor treasury
    for (const t of [tera, usdc, zen]) await t.mint(await vendor.getAddress(), E(1_000_000));
    await owner.sendTransaction({ to: await vendor.getAddress(), value: E(10) });

    // give the user tokens + approvals
    for (const t of [tera, usdc, zen]) {
      await t.mint(user.address, E(1000));
      await t.connect(user).approve(await vendor.getAddress(), ethers.MaxUint256);
    }
  });

  it("registers the token set and rate", async () => {
    expect(await vendor.rate()).to.equal(100n);
    expect(await vendor.supportedTokens()).to.have.lengthOf(3);
    expect(await vendor.isSupported(await zen.getAddress())).to.equal(true);
  });

  it("swaps ETH -> token at the rate", async () => {
    const before = await zen.balanceOf(user.address);
    await vendor.connect(user).swap(ZERO, await zen.getAddress(), E(2), 0, { value: E(2) });
    expect((await zen.balanceOf(user.address)) - before).to.equal(E(200)); // 2 ETH * 100
  });

  it("swaps token -> ETH at 1/rate", async () => {
    const before = await ethers.provider.getBalance(user.address);
    const tx = await vendor.connect(user).swap(await zen.getAddress(), ZERO, E(300), 0);
    const rc = await tx.wait();
    const gas = rc.gasUsed * rc.gasPrice;
    const gained = (await ethers.provider.getBalance(user.address)) - before + gas;
    expect(gained).to.equal(E(3)); // 300 ZEN / 100
  });

  it("swaps token -> token 1:1 (ZEN -> TERA)", async () => {
    const before = await tera.balanceOf(user.address);
    await vendor.connect(user).swap(await zen.getAddress(), await tera.getAddress(), E(250), 0);
    expect((await tera.balanceOf(user.address)) - before).to.equal(E(250));
  });

  it("reverts on an unsupported token", async () => {
    const rogue = await (await ethers.getContractFactory("MockERC20")).deploy("Rogue", "RGE", 18);
    await expect(
      vendor.connect(user).swap(await rogue.getAddress(), ZERO, E(1), 0)
    ).to.be.revertedWithCustomError(vendor, "UnsupportedToken");
  });

  it("reverts on slippage and on identical tokens", async () => {
    await expect(
      vendor.connect(user).swap(ZERO, await zen.getAddress(), E(1), E(9999), { value: E(1) })
    ).to.be.revertedWithCustomError(vendor, "SlippageExceeded");
    await expect(
      vendor.connect(user).swap(await zen.getAddress(), await zen.getAddress(), E(1), 0)
    ).to.be.revertedWithCustomError(vendor, "SameToken");
  });

  it("reverts when the treasury can't cover the output", async () => {
    await vendor.withdrawToken(await tera.getAddress(), E(1_000_000)); // drain TERA
    await expect(
      vendor.connect(user).swap(await zen.getAddress(), await tera.getAddress(), E(100), 0)
    ).to.be.revertedWithCustomError(vendor, "InsufficientTreasury");
  });

  it("owner can add a token and change the rate", async () => {
    const extra = await (await ethers.getContractFactory("MockERC20")).deploy("Extra", "EXT", 18);
    await vendor.setToken(await extra.getAddress(), true);
    expect(await vendor.isSupported(await extra.getAddress())).to.equal(true);
    await vendor.setRate(50n);
    expect(await vendor.quote(ZERO, await zen.getAddress(), E(1))).to.equal(E(50));
  });
});
