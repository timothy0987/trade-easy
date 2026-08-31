// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TERA
 * @notice The project's native token.
 *
 *         Testnet build: `mint` is open so anyone can get some for testing, and any
 *         address the owner adds as a minter can emit more (e.g. an XP/rewards
 *         distributor). On a funded mainnet build the open mint is removed and supply
 *         comes only from a capped, role-gated emissions schedule tied to the leaderboard
 *         (transactions -> XP -> TERA).
 */
contract TERA is ERC20, Ownable {
    mapping(address => bool) public isMinter;

    event MinterSet(address indexed account, bool allowed);

    constructor(address initialOwner) ERC20("Trade Easy", "TERA") Ownable(initialOwner) {}

    /// @notice Open mint — testnet only.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Gated mint for authorized distributors (rewards / emissions).
    function mintFor(address to, uint256 amount) external {
        require(isMinter[msg.sender], "not minter");
        _mint(to, amount);
    }

    function setMinter(address account, bool allowed) external onlyOwner {
        isMinter[account] = allowed;
        emit MinterSet(account, allowed);
    }
}
