const hre = require("hardhat");

async function main() {
    const treasuryAddress = "0x8C7ee3Fe0A34F864723A2C58ce8fE4342fC296Cf";
    const usdcAddress = "0x9e70989197BD91F1B14C06A2e8bc77F1bb3DC068";

    console.log(`Checking USDC balance for Treasury: ${treasuryAddress}`);

    const tokenABI = [
        "function balanceOf(address account) view returns (uint256)",
        "function decimals() view returns (uint8)"
    ];
    
    const usdcContract = new hre.ethers.Contract(usdcAddress, tokenABI, hre.ethers.provider);
    
    const decimals = await usdcContract.decimals();
    const balance = await usdcContract.balanceOf(treasuryAddress);
    
    console.log(`USDC Balance: ${hre.ethers.formatUnits(balance, decimals)} USDC`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
