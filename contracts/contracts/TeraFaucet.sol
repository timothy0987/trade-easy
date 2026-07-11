// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Minimal ERC20 interface for the transfer function
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// HTS Precompile Interface for Association
interface IHederaTokenService {
    function associateToken(address account, address token) external returns (int64 responseCode);
    function associateTokens(address account, address[] memory tokens) external returns (int64 responseCode);
}

contract TeraFaucet {
    IERC20 public teraToken;
    address public constant HTS_ADDRESS = address(0x167);
    
    // 100 TERA (assuming 8 decimals for HTS compatibility)
    uint256 public constant CLAIM_AMOUNT = 100 * 10**8; 
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

    // Call the HTS precompile to associate this contract with an HTS token
    function associateToken(address _token) external {
        (bool success, bytes memory result) = HTS_ADDRESS.call(
            abi.encodeWithSelector(IHederaTokenService.associateToken.selector, address(this), _token)
        );
        require(success, "Association call failed");
        
        int64 responseCode = abi.decode(result, (int64));
        require(responseCode == 22, "Association failed, response != 22 (SUCCESS)");
    }
}
