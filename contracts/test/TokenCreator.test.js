const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenCreator (plain ERC20 factory)", () => {
  let factory, owner, alice, bob;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();
    factory = await (await ethers.getContractFactory("TokenCreator")).deploy();
  });

  it("deploys an ERC20 and mints the whole supply to the creator", async () => {
    const tx = await factory.connect(alice).createToken("Antigravity", "ANTI", 1_000_000n, 18);
    const rc = await tx.wait();

    const tokens = await factory.getUserTokens(alice.address);
    expect(tokens.length).to.equal(1);

    const token = await ethers.getContractAt("TradeEasyToken", tokens[0]);
    expect(await token.name()).to.equal("Antigravity");
    expect(await token.symbol()).to.equal("ANTI");
    expect(await token.decimals()).to.equal(18);
    expect(await token.totalSupply()).to.equal(ethers.parseUnits("1000000", 18));
    expect(await token.balanceOf(alice.address)).to.equal(ethers.parseUnits("1000000", 18));

    await expect(tx).to.emit(factory, "TokenCreated").withArgs(alice.address, tokens[0], "Antigravity", "ANTI");
  });

  it("honours a non-18 decimals value", async () => {
    await factory.connect(alice).createToken("Six", "SIX", 500n, 6);
    const [t] = await factory.getUserTokens(alice.address);
    const token = await ethers.getContractAt("TradeEasyToken", t);
    expect(await token.decimals()).to.equal(6);
    expect(await token.totalSupply()).to.equal(ethers.parseUnits("500", 6));
  });

  it("lets only the creator mint more, via the factory", async () => {
    await factory.connect(alice).createToken("Mintable", "MINT", 100n, 18);
    const [t] = await factory.getUserTokens(alice.address);
    const token = await ethers.getContractAt("TradeEasyToken", t);

    await expect(factory.connect(bob).mintAdditional(t, 50n)).to.be.revertedWithCustomError(factory, "NotTokenCreator");

    await factory.connect(alice).mintAdditional(t, 50n);
    expect(await token.balanceOf(alice.address)).to.equal(ethers.parseUnits("150", 18));

    // direct mint on the token is factory-only
    await expect(token.connect(alice).factoryMint(alice.address, 1n)).to.be.revertedWithCustomError(token, "OnlyFactory");
  });

  it("forwards the creation fee to feeRecipient", async () => {
    const fee = ethers.parseEther("0.01");
    await expect(
      factory.connect(alice).createToken("Fee", "FEE", 1n, 18, { value: fee })
    ).to.changeEtherBalance(owner, fee);
  });
});
