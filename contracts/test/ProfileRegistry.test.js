const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProfileRegistry", () => {
  let reg, alice, bob;

  beforeEach(async () => {
    [, alice, bob] = await ethers.getSigners();
    reg = await (await ethers.getContractFactory("ProfileRegistry")).deploy();
  });

  it("sets and reads a profile", async () => {
    await expect(reg.connect(alice).setProfile("alice.hz", "data:image/png;base64,AAAA"))
      .to.emit(reg, "ProfileUpdated")
      .withArgs(alice.address, "alice.hz", "data:image/png;base64,AAAA");
    const p = await reg.getProfile(alice.address);
    expect(p.name).to.equal("alice.hz");
    expect(p.avatarURI).to.equal("data:image/png;base64,AAAA");
    expect(p.updatedAt).to.be.gt(0);
  });

  it("only the owner can change their own profile", async () => {
    await reg.connect(alice).setProfile("alice", "x");
    await reg.connect(bob).setProfile("bob", "y");
    expect((await reg.getProfile(alice.address)).name).to.equal("alice");
    expect((await reg.getProfile(bob.address)).name).to.equal("bob");
  });

  it("batch getProfiles returns one entry per address, blank for unset", async () => {
    await reg.connect(alice).setProfile("alice", "a");
    const out = await reg.getProfiles([alice.address, bob.address]);
    expect(out.length).to.equal(2);
    expect(out[0].name).to.equal("alice");
    expect(out[1].name).to.equal("");
  });

  it("tracks the user list and pages it", async () => {
    await reg.connect(alice).setProfile("a", "");
    await reg.connect(bob).setProfile("b", "");
    await reg.connect(alice).setProfile("a2", ""); // update, not a new user
    expect(await reg.userCount()).to.equal(2);
    expect(await reg.usersPage(0, 10)).to.deep.equal([alice.address, bob.address]);
    expect(await reg.usersPage(1, 10)).to.deep.equal([bob.address]);
    expect(await reg.usersPage(5, 10)).to.deep.equal([]);
  });

  it("enforces the byte caps", async () => {
    await expect(reg.connect(alice).setProfile("x".repeat(65), "")).to.be.revertedWithCustomError(reg, "NameTooLong");
    await expect(reg.connect(alice).setProfile("ok", "x".repeat(12001))).to.be.revertedWithCustomError(reg, "AvatarTooLong");
  });

  it("clears a profile", async () => {
    await reg.connect(alice).setProfile("alice", "a");
    await expect(reg.connect(alice).clearProfile()).to.emit(reg, "ProfileCleared").withArgs(alice.address);
    const p = await reg.getProfile(alice.address);
    expect(p.name).to.equal("");
    expect(p.avatarURI).to.equal("");
  });
});
