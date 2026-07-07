// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") {
        // Mint initial supply to deployer (e.g. 100 million USDC)
        _mint(msg.sender, 100000000 * 10**6);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
