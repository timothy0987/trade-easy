// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TokenVendor {
    IERC20 public teraToken;
    uint256 public tokensPerHbar = 100; // 1 HBAR = 100 TERA
    address public owner;

    event TokensPurchased(address buyer, uint256 amountOfHbar, uint256 amountOfTokens);

    constructor(address _teraToken) {
        teraToken = IERC20(_teraToken);
        owner = msg.sender;
    }

    // Function to buy tokens
    function buyTokens() public payable {
        require(msg.value > 0, "Send HBAR to buy tokens");

        uint256 amountToBuy = msg.value * tokensPerHbar;
        uint256 vendorBalance = teraToken.balanceOf(address(this));

        require(vendorBalance >= amountToBuy, "Vendor has insufficient tokens");

        bool sent = teraToken.transfer(msg.sender, amountToBuy);
        require(sent, "Failed to transfer token to user");

        emit TokensPurchased(msg.sender, msg.value, amountToBuy);
    }

    // Allow owner to withdraw HBAR
    function withdraw() public {
        require(msg.sender == owner, "Only owner can withdraw");
        uint256 balance = address(this).balance;
        require(balance > 0, "No HBAR to withdraw");

        (bool sent, ) = msg.sender.call{value: balance}("");
        require(sent, "Failed to send HBAR");
    }

    receive() external payable {
        buyTokens();
    }
}
