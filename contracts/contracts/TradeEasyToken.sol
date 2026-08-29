// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TradeEasyToken
 * @notice Plain ERC20 deployed by the TokenCreator factory on Horizen. The whole initial
 *         supply is minted to the creator; further supply can only be minted through the
 *         factory (which gates it on the original creator).
 */
contract TradeEasyToken is ERC20 {
    address public immutable factory;
    uint8 private immutable _decimals;

    error OnlyFactory();

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialRawSupply,
        address recipient,
        address factory_
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
        factory = factory_;
        if (initialRawSupply > 0) _mint(recipient, initialRawSupply);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Mint additional supply. Only the deploying factory may call.
    function factoryMint(address to, uint256 rawAmount) external {
        if (msg.sender != factory) revert OnlyFactory();
        _mint(to, rawAmount);
    }
}
