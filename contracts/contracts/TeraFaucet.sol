// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Minimal ERC20 interface for the transfer function
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TeraFaucet {
    IERC20 public teraToken;
    
    // 100 TERA (assuming 18 decimals)
    uint256 public constant CLAIM_AMOUNT = 100 * 10**18; 
    uint256 public constant LOCK_TIME = 24 hours;

    mapping(address => uint256) public nextClaimTime;

    event TeraClaimed(address indexed to, uint256 amount, uint256 nextClaim);

    constructor(address _teraTokenAddress) {
        require(_teraTokenAddress != address(0), "Invalid token address");
        teraToken = IERC20(_teraTokenAddress);
    }

    function claimTera() external {
        // 1. Check time lock
        require(block.timestamp >= nextClaimTime[msg.sender], "You must wait 24 hours between claims");

        // 2. Check treasury balance
        require(teraToken.balanceOf(address(this)) >= CLAIM_AMOUNT, "Faucet treasury is empty");

        // 3. Update the lock time FIRST to prevent reentrancy attacks
        nextClaimTime[msg.sender] = block.timestamp + LOCK_TIME;

        // 4. Transfer the tokens from the Faucet treasury to the user
        bool success = teraToken.transfer(msg.sender, CLAIM_AMOUNT);
        require(success, "Token transfer failed");

        emit TeraClaimed(msg.sender, CLAIM_AMOUNT, nextClaimTime[msg.sender]);
    }
}
