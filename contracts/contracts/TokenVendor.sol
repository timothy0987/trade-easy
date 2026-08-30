// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenVendor
 * @notice Fixed-rate testnet swap venue for Horizen. Native ETH plus any registered
 *         18-decimal ERC-20 (TERA, USDC, ZEN), all pegged at `rate` tokens per 1 ETH
 *         (default 100). Swap ETH<->token or token<->token; the vendor pays from its
 *         own treasury, so keep it funded (`npm run fund`).
 *
 *         This is a demo venue, not an AMM: prices are fixed, trade size causes no
 *         slippage, and `rate` / the token set are owner-controlled.
 */
contract TokenVendor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant ETH = address(0); // sentinel for the native asset

    uint256 public rate; // registered-token units per 1 ETH (tokens assumed 18-dec)
    address[] private _tokens;
    mapping(address => bool) public isSupported;

    event Swapped(
        address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut
    );
    event TokenSet(address indexed token, bool supported);
    event RateSet(uint256 rate);

    error SameToken();
    error UnsupportedToken(address token);
    error ZeroAmount();
    error EthValueMismatch();
    error TokenSwapNoValue();
    error SlippageExceeded(uint256 amountOut, uint256 minOut);
    error InsufficientTreasury(address token, uint256 have, uint256 need);
    error EthSendFailed();

    constructor(address initialOwner, uint256 rate_, address[] memory tokens_) Ownable(initialOwner) {
        rate = rate_;
        emit RateSet(rate_);
        for (uint256 i; i < tokens_.length; ++i) {
            _addToken(tokens_[i]);
            emit TokenSet(tokens_[i], true);
        }
    }

    /// @return amountOut for swapping `amountIn` of `tokenIn` into `tokenOut` (0 sentinel = ETH).
    function quote(address tokenIn, address tokenOut, uint256 amountIn) public view returns (uint256) {
        if (tokenIn == tokenOut) return 0;
        if (tokenIn == ETH) return amountIn * rate; // ETH -> token
        if (tokenOut == ETH) return amountIn / rate; // token -> ETH
        return amountIn; // token <-> token (both pegged 1:1)
    }

    /// @param tokenIn  address(0) for ETH, else a supported ERC-20 (approve first)
    /// @param tokenOut address(0) for ETH, else a supported ERC-20
    /// @param amountIn ETH: must equal msg.value. ERC-20: pulled via transferFrom.
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut)
        external
        payable
        nonReentrant
        returns (uint256 amountOut)
    {
        if (tokenIn == tokenOut) revert SameToken();
        if (tokenIn != ETH && !isSupported[tokenIn]) revert UnsupportedToken(tokenIn);
        if (tokenOut != ETH && !isSupported[tokenOut]) revert UnsupportedToken(tokenOut);

        if (tokenIn == ETH) {
            if (msg.value == 0 || msg.value != amountIn) revert EthValueMismatch();
        } else {
            if (msg.value != 0) revert TokenSwapNoValue();
            if (amountIn == 0) revert ZeroAmount();
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        }

        amountOut = quote(tokenIn, tokenOut, amountIn);
        if (amountOut == 0) revert ZeroAmount();
        if (amountOut < minOut) revert SlippageExceeded(amountOut, minOut);

        if (tokenOut == ETH) {
            uint256 have = address(this).balance;
            if (have < amountOut) revert InsufficientTreasury(ETH, have, amountOut);
            (bool ok,) = msg.sender.call{value: amountOut}("");
            if (!ok) revert EthSendFailed();
        } else {
            uint256 have = IERC20(tokenOut).balanceOf(address(this));
            if (have < amountOut) revert InsufficientTreasury(tokenOut, have, amountOut);
            IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        }

        emit Swapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    function supportedTokens() external view returns (address[] memory) {
        return _tokens;
    }

    // --- admin ---

    function setToken(address token, bool supported) external onlyOwner {
        if (supported) _addToken(token);
        else isSupported[token] = false;
        emit TokenSet(token, supported);
    }

    function setRate(uint256 rate_) external onlyOwner {
        rate = rate_;
        emit RateSet(rate_);
    }

    function withdrawEth(uint256 amount) external onlyOwner {
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert EthSendFailed();
    }

    function withdrawToken(IERC20 token, uint256 amount) external onlyOwner {
        token.safeTransfer(msg.sender, amount);
    }

    function _addToken(address token) private {
        if (token == address(0)) revert UnsupportedToken(token);
        if (!isSupported[token]) {
            isSupported[token] = true;
            _tokens.push(token);
        }
    }

    receive() external payable {} // plain ETH funding, no auto-swap
}
