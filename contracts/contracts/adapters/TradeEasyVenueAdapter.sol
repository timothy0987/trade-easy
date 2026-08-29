// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ITradeVenue} from "../interfaces/ITradeVenue.sol";

interface ITradeEasyRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/**
 * @title TradeEasyVenueAdapter
 * @notice Wraps the local constant-product AMM (TradeEasyRouter) behind ITradeVenue so the
 *         PrivateTradingVault can route fills through it. This is the M1 venue: self-contained
 *         liquidity on Horizen testnet, no dependency on external DEX deployments.
 *
 * @dev    The vault transfers `amountIn` of `tokenIn` to this adapter, then calls `swap`.
 *         The adapter approves the router and forwards the trade, sending output straight
 *         to `recipient` (the vault). Holds no funds between calls.
 *
 *         M2: a DarkSwapVenueAdapter with the same interface routes through Horizen's
 *         private DEX for venue-layer execution privacy (hidden size/price, MEV-proof).
 */
contract TradeEasyVenueAdapter is ITradeVenue {
    using SafeERC20 for IERC20;

    ITradeEasyRouter public immutable router;

    constructor(address router_) {
        router = ITradeEasyRouter(router_);
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        bytes calldata /* venueData */
    ) external override returns (uint256 amountOut) {
        IERC20(tokenIn).forceApprove(address(router), amountIn);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts =
            router.swapExactTokensForTokens(amountIn, minAmountOut, path, recipient, block.timestamp);
        amountOut = amounts[amounts.length - 1];

        // Leave no dangling allowance.
        IERC20(tokenIn).forceApprove(address(router), 0);
    }
}
