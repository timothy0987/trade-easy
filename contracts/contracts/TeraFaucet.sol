// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITERA {
    function mint(address to, uint256 amount) external;
}

contract TeraFaucet {
    address public teraToken;
    mapping(address => uint256) public nextClaimTime;

    uint256 public constant CLAIM_AMOUNT = 100 * 10**18;
    uint256 public constant LOCK_DURATION = 24 hours;

    constructor(address _teraToken) {
        teraToken = _teraToken;
    }

    function claimTera() external {
        require(block.timestamp >= nextClaimTime[msg.sender], "TeraFaucet: Try again later (24h lock)");
        
        // Update next claim time
        nextClaimTime[msg.sender] = block.timestamp + LOCK_DURATION;

        // Mint 100 TERA to the caller
        ITERA(teraToken).mint(msg.sender, CLAIM_AMOUNT);
    }
}
