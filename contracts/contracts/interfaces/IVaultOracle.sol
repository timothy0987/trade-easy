// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVaultOracle
 * @notice Prices a token holding in terms of the vault's accounting asset.
 *         Used to compute NAV (totalAssets) across positions the agent has opened.
 *
 * @dev M1 uses a simple spot oracle (e.g. reading the TradeEasy AMM reserves or a
 *      Chainlink-style feed). M2 replaces per-position disclosure with a committed
 *      NAV proven via zkVerify; this interface stays the same for the transparent path.
 */
interface IVaultOracle {
    /// @return value The worth of `amount` units of `token`, denominated in the vault asset.
    function valueInAsset(address token, uint256 amount) external view returns (uint256 value);
}
