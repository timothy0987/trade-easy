const hre = require("hardhat");

/**
 * Settles every pending redemption request in the queue, signed by the
 * deployer key (owner/agent — processRedeemRequests is onlyAgentOrOwner).
 *
 *   npx hardhat run scripts/settleRedemptions.js --network horizenTestnet
 */
async function main() {
  const { ethers } = hre;
  const [signer] = await ethers.getSigners();
  const A = require("../../frontend/src/contracts/addresses.json");

  console.log(`Network : ${hre.network.name}`);
  console.log(`Signer  : ${signer.address}\n`);

  const vault = await ethers.getContractAt("PrivateTradingVault", A.PrivateTradingVault, signer);

  const count = await vault.redeemRequestCount();
  const pending = [];
  for (let i = 0; i < Number(count); i++) {
    const r = await vault.redeemRequests(i);
    // struct: owner, shares, assetsOwed, requestedAt, processed, claimed
    if (!r[4]) pending.push(i);
  }

  console.log(`Redemption requests: ${count} total, ${pending.length} pending: [${pending.join(", ")}]`);
  if (pending.length === 0) {
    console.log("Nothing to settle.");
    return;
  }

  const tx = await vault.processRedeemRequests(pending);
  const rcpt = await tx.wait();
  console.log(`\nSettled. tx: ${rcpt.hash}`);

  for (const id of pending) {
    const r = await vault.redeemRequests(id);
    console.log(`  #${id}: owed ${ethers.formatUnits(r[2], 18)} (processed=${r[4]})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
