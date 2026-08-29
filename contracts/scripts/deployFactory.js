const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploys the plain-EVM TokenCreator (ERC20 factory) to Horizen and merges its address
 * into frontend/src/contracts/addresses.json. Also refreshes the TokenCreator ABI.
 *
 *   npm run deploy:factory
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const Factory = await hre.ethers.getContractFactory("TokenCreator");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const addr = await factory.getAddress();
  console.log(`TokenCreator -> ${addr}`);

  const outDir = path.join(__dirname, "../../frontend/src/contracts");
  const addrPath = path.join(outDir, "addresses.json");
  let addresses = {};
  if (fs.existsSync(addrPath)) addresses = JSON.parse(fs.readFileSync(addrPath, "utf8"));

  addresses = {
    ...addresses,
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    TokenCreator: addr,
    timestamp: new Date().toISOString(),
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(addrPath, JSON.stringify(addresses, null, 2));

  for (const name of ["TokenCreator", "TradeEasyToken"]) {
    const art = hre.artifacts.readArtifactSync(name);
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(art.abi, null, 2));
  }

  console.log("Merged TokenCreator address + ABIs into frontend/src/contracts/");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
