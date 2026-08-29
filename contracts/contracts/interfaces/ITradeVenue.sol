// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITradeVenue
 * @notice Uniform adapter the vault calls to route a trade to an external venue.
 *         One implementation per venue:
 *           - TradeEasyVenueAdapter  -> the local constant-product AMM (M1, self-contained liquidity)
 *           - DarkSwapVenueAdapter   -> Horizen's private DEX (M2, execution privacy at the venue layer)
 *
 * @dev The vault transfers `amountIn` of `tokenIn` to the adapter before calling `swap`.
 *      The adapter must send at least `minAmountOut` of `tokenOut` to `recipient` or revert.
 */
interface ITradeVenue {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        bytes calldata venueData
    ) external returns (uint256 amountOut);
}
