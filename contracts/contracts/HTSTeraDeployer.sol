// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IHederaTokenService {
    struct TokenKey {
        uint256 keyType;
        KeyValue keyValue;
    }

    struct KeyValue {
        bool inheritAccountKey;
        address contractId;
        bytes ed25519;
        bytes ECDSA_secp256k1;
        address delegatableContractId;
    }

    struct HederaToken {
        string name;
        string symbol;
        address treasury;
        string memo;
        bool tokenSupplyType; // true for FINITE, false for INFINITE
        int64 maxSupply;
        bool freezeDefault;
        TokenKey[] tokenKeys;
        Expiry expiry;
    }

    struct Expiry {
        uint32 second;
        address autoRenewAccount;
        uint32 autoRenewPeriod;
    }

    function createFungibleToken(
        HederaToken memory token,
        int64 initialTotalSupply,
        int32 decimals
    ) external payable returns (int256 responseCode, address tokenAddress);
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract HTSTeraDeployer {
    address public constant HTS_ADDRESS = address(0x167);
    IHederaTokenService constant hts = IHederaTokenService(HTS_ADDRESS);

    function deployTeraHTS() external payable returns (address) {
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0] = IHederaTokenService.TokenKey({
            keyType: 2, // SUPPLY KEY
            keyValue: IHederaTokenService.KeyValue({
                inheritAccountKey: false,
                contractId: address(this),
                ed25519: new bytes(0),
                ECDSA_secp256k1: new bytes(0),
                delegatableContractId: address(0)
            })
        });

        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry({
            second: 0,
            autoRenewAccount: address(this),
            autoRenewPeriod: 7890000 
        });

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken({
            name: "Trade Easy Token",
            symbol: "TERA",
            treasury: address(this),
            memo: "Native HTS TERA",
            tokenSupplyType: false,
            maxSupply: 0,
            freezeDefault: false,
            tokenKeys: keys,
            expiry: expiry
        });

        // initialSupply: 100,000,000 * 10^18
        // For HTS, 10^18 might be too large for int64. Max int64 is 9.22 * 10^18.
        // Let's use 8 decimals for HTS to fit well within int64, or use uint256 if possible. 
        // Wait, HTS createFungibleToken takes int64 for initialTotalSupply.
        // Let's use 100,000,000 tokens with 8 decimals = 10,000,000,000,000,000 (fits in int64)
        int64 initialSupply = 10000000000000000;
        int32 decimals = 8;

        (int256 responseCode, address tokenAddress) = hts.createFungibleToken{value: msg.value}(
            token,
            initialSupply,
            decimals
        );

        require(responseCode == 22, "HTS: Token creation failed");

        return tokenAddress;
    }

    function transferOut(address token, address to, uint256 amount) external {
        IERC20(token).transfer(to, amount);
    }
}
