// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockTERA {
    string public name = "Trade Easy Token";
    string public symbol = "TERA";
    uint8 public decimals = 18;
    
    // Always returns a positive balance so the fee discount logic triggers for the demo!
    function balanceOf(address) external pure returns (uint256) {
        return 1000 * 10**18;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return true;
    }

    function approve(address, uint256) external pure returns (bool) {
        return true;
    }
}
