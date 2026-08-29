// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TradeEasyToken} from "./TradeEasyToken.sol";

/**
 * @title TokenCreator
 * @notice Plain-EVM ERC20 factory for Horizen. Replaces the former Hedera HTS-precompile
 *         wrapper of the same name (keeps the createToken / getUserTokens / mintAdditional
 *         interface so the frontend and agent route are unchanged).
 *
 *         Each createToken deploys a standard {TradeEasyToken}; the full initial supply
 *         goes to the caller. Only the original creator can mint more, and only via this
 *         factory. An optional creation fee (msg.value) is forwarded to `feeRecipient`.
 */
contract TokenCreator {
    mapping(address => address[]) public userTokens; // creator => tokens
    mapping(address => address) public tokenCreator; // token => creator
    address[] public allTokens;

    address public feeRecipient;

    event TokenCreated(address indexed creator, address indexed tokenAddress, string name, string symbol);
    event TokensMinted(address indexed tokenAddress, uint256 amount, uint256 newTotalSupply);

    error NotTokenCreator();

    constructor() {
        feeRecipient = msg.sender;
    }

    /// @param initialSupply whole-token amount (scaled by `decimals` at mint time)
    function createToken(
        string calldata name,
        string calldata symbol,
        uint256 initialSupply,
        uint8 decimals
    ) external payable returns (address) {
        uint256 raw = initialSupply * (10 ** uint256(decimals));
        TradeEasyToken token = new TradeEasyToken(name, symbol, decimals, raw, msg.sender, address(this));
        address addr = address(token);

        userTokens[msg.sender].push(addr);
        tokenCreator[addr] = msg.sender;
        allTokens.push(addr);

        if (msg.value > 0) {
            (bool ok, ) = feeRecipient.call{value: msg.value}("");
            require(ok, "fee transfer failed");
        }

        emit TokenCreated(msg.sender, addr, name, symbol);
        return addr;
    }

    /// @notice Mint more of a token you created. `amount` is in whole tokens.
    function mintAdditional(address token, uint256 amount) external returns (bool) {
        if (tokenCreator[token] != msg.sender) revert NotTokenCreator();
        TradeEasyToken t = TradeEasyToken(token);
        uint256 raw = amount * (10 ** uint256(t.decimals()));
        t.factoryMint(msg.sender, raw);
        emit TokensMinted(token, amount, t.totalSupply());
        return true;
    }

    function getUserTokens(address user) external view returns (address[] memory) {
        return userTokens[user];
    }

    function allTokensLength() external view returns (uint256) {
        return allTokens.length;
    }

    function setFeeRecipient(address r) external {
        require(msg.sender == feeRecipient, "not fee recipient");
        feeRecipient = r;
    }
}
