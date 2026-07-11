const hre = require("hardhat");

async function main() {
    const addressToCheck = "0x2Bf02B8f63C51B27cDb792e70ff3c3Bc5BacE1F3"; // Faucet Treasury
    const teraAddress = "0x23A7f77CDc477972e463B83fFc730aCda0fa964D"; // TERA Token

    console.log(`Checking balances for Treasury: ${addressToCheck}`);

    // Check HBAR Balance
    const hbarBalance = await hre.ethers.provider.getBalance(addressToCheck);
    console.log(`HBAR Balance: ${hre.ethers.formatEther(hbarBalance)} HBAR`);

    // Check TERA Balance
    const teraABI = [
        "function balanceOf(address account) view returns (uint256)"
    ];
    const teraContract = new hre.ethers.Contract(teraAddress, teraABI, hre.ethers.provider);
    const teraBalance = await teraContract.balanceOf(addressToCheck);
    console.log(`TERA Balance: ${hre.ethers.formatEther(teraBalance)} TERA`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
