// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockTERA is ERC20 {
    constructor(string memory name, string memory symbol, uint8) ERC20(name, symbol) {
        // Mint a large supply to the deployer so they can transfer it to the Faucet
        _mint(msg.sender, 1000000000 * 10 ** decimals());
    }
}
