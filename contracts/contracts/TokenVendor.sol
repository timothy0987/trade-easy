// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// HTS Precompile Interface for Association
interface IHederaTokenService {
    function associateToken(address account, address token) external returns (int64 responseCode);
}

contract TokenVendor {
    IERC20 public teraToken;
    address public usdcToken;
    uint256 public tokensPerHbar = 100; // 1 HBAR = 100 TERA
    uint256 public usdcPerHbar = 100;   // 1 HBAR = 100 USDC
    address public owner;
    address public constant HTS_ADDRESS = address(0x167);

    event TokensPurchased(address buyer, uint256 amountOfHbar, uint256 amountOfTokens);
    event TokensSold(address seller, uint256 amountOfTokens, uint256 amountOfHbar);
    event UsdcPurchased(address buyer, uint256 amountOfHbar, uint256 amountOfUsdc);
    event UsdcSold(address seller, uint256 amountOfUsdc, uint256 amountOfHbar);
    event SwappedTeraForUsdc(address user, uint256 teraAmount, uint256 usdcAmount);
    event SwappedUsdcForTera(address user, uint256 usdcAmount, uint256 teraAmount);

    constructor(address _teraToken, address _usdcToken) {
        teraToken = IERC20(_teraToken);
        usdcToken = _usdcToken;
        owner = msg.sender;
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

    // Function to buy tokens
    function buyTokens() public payable {
        require(msg.value > 0, "Send HBAR to buy tokens");

        uint256 amountToBuy = msg.value * tokensPerHbar;
        uint256 vendorBalance = teraToken.balanceOf(address(this));

        require(vendorBalance >= amountToBuy, "Treasury has insufficient TERA balance");

        bool sent = teraToken.transfer(msg.sender, amountToBuy);
        require(sent, "Failed to transfer token to user");

        emit TokensPurchased(msg.sender, msg.value, amountToBuy);
    }

    // Function to sell TERA for HBAR
    function sellTera(uint256 teraAmount) public {
        require(teraAmount > 0, "Amount must be greater than 0");
        uint256 hbarAmount = teraAmount / tokensPerHbar;
        require(address(this).balance >= hbarAmount, "Insufficient HBAR in treasury");

        bool success = teraToken.transferFrom(msg.sender, address(this), teraAmount);
        require(success, "TERA transfer failed");

        payable(msg.sender).transfer(hbarAmount);
        emit TokensSold(msg.sender, teraAmount, hbarAmount);
    }

    // Function to buy USDC with HBAR
    function buyUsdc() public payable {
        require(msg.value > 0, "Send HBAR to buy USDC");
        uint256 amountToBuy = msg.value * usdcPerHbar;
        uint256 vendorBalance = IERC20(usdcToken).balanceOf(address(this));
        
        require(vendorBalance >= amountToBuy, "Treasury has insufficient USDC balance");

        bool sent = IERC20(usdcToken).transfer(msg.sender, amountToBuy);
        require(sent, "Failed to transfer USDC to user");

        emit UsdcPurchased(msg.sender, msg.value, amountToBuy);
    }

    // Function to sell USDC for HBAR
    function sellUsdc(uint256 usdcAmount) public {
        require(usdcAmount > 0, "Amount must be greater than 0");
        uint256 hbarAmount = usdcAmount / usdcPerHbar;
        require(address(this).balance >= hbarAmount, "Insufficient HBAR in treasury");

        bool success = IERC20(usdcToken).transferFrom(msg.sender, address(this), usdcAmount);
        require(success, "USDC transfer failed");

        payable(msg.sender).transfer(hbarAmount);
        emit UsdcSold(msg.sender, usdcAmount, hbarAmount);
    }

    // Function to swap TERA for USDC
    function swapTeraForUsdc(uint256 teraAmount) public {
        require(teraAmount > 0, "Amount must be greater than 0");
        // Calculate HBAR equivalent then USDC amount
        uint256 hbarEquivalent = teraAmount / tokensPerHbar;
        uint256 usdcAmount = hbarEquivalent * usdcPerHbar;
        
        require(IERC20(usdcToken).balanceOf(address(this)) >= usdcAmount, "Insufficient USDC in treasury");

        bool successTera = teraToken.transferFrom(msg.sender, address(this), teraAmount);
        require(successTera, "TERA transfer failed");

        bool successUsdc = IERC20(usdcToken).transfer(msg.sender, usdcAmount);
        require(successUsdc, "USDC transfer failed");

        emit SwappedTeraForUsdc(msg.sender, teraAmount, usdcAmount);
    }

    // Function to swap USDC for TERA
    function swapUsdcForTera(uint256 usdcAmount) public {
        require(usdcAmount > 0, "Amount must be greater than 0");
        uint256 hbarEquivalent = usdcAmount / usdcPerHbar;
        uint256 teraAmount = hbarEquivalent * tokensPerHbar;

        require(teraToken.balanceOf(address(this)) >= teraAmount, "Insufficient TERA in treasury");

        bool successUsdc = IERC20(usdcToken).transferFrom(msg.sender, address(this), usdcAmount);
        require(successUsdc, "USDC transfer failed");

        bool successTera = teraToken.transfer(msg.sender, teraAmount);
        require(successTera, "TERA transfer failed");

        emit SwappedUsdcForTera(msg.sender, usdcAmount, teraAmount);
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
