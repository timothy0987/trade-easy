// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVaultOracle} from "../interfaces/IVaultOracle.sol";

/**
 * @notice Test oracle with governance-set prices. `price` is WAD-scaled units of the
 *         vault asset per 1e18 base units of `token`.
 *
 *         M1 replaces this with a TWAP oracle over the TradeEasy AMM (or a Horizen
 *         price feed). Spot-reserve pricing is manipulable and must not gate a real vault.
 */
contract MockOracle is IVaultOracle {
    mapping(address => uint256) public price; // token => WAD price in asset terms
    address public owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function setPrice(address token, uint256 wadPrice) external {
        require(msg.sender == owner, "not owner");
        price[token] = wadPrice;
    }

    function valueInAsset(address token, uint256 amount) external view override returns (uint256) {
        uint256 p = price[token];
        require(p != 0, "no price");
        return (amount * p) / 1e18;
    }
}
