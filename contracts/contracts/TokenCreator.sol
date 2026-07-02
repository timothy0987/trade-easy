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

    function mintToken(
        address token,
        int64 amount,
        bytes[] calldata metadata
    ) external returns (int256 responseCode, uint64 newTotalSupply, int64[] memory serialNumbers);
}

contract TokenCreator {
    // Address of the Hedera Token Service precompile
    address public constant HTS_ADDRESS = address(0x167);
    IHederaTokenService constant hts = IHederaTokenService(HTS_ADDRESS);

    // Track tokens created by each user
    mapping(address => address[]) public userTokens;
    
    event TokenCreated(address indexed creator, address indexed tokenAddress, string name, string symbol);
    event TokensMinted(address indexed tokenAddress, uint64 amount, uint64 newTotalSupply);

    /**
     * @notice Creates a new fungible Hedera native token
     */
    function createToken(
        string memory name,
        string memory symbol,
        int64 initialSupply,
        int32 decimals
    ) external payable returns (address) {
        // Prepare the supply key so the contract itself can mint/burn
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

        // Set up the expiry parameters
        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry({
            second: 0,
            autoRenewAccount: msg.sender,
            autoRenewPeriod: 7890000 // ~3 months in seconds
        });

        // Create the token struct
        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken({
            name: name,
            symbol: symbol,
            treasury: address(this), // The contract acts as treasury to facilitate AMM seeding
            memo: "Created via Trade Easy",
            tokenSupplyType: false, // INFINITE supply
            maxSupply: 0,
            freezeDefault: false,
            tokenKeys: keys,
            expiry: expiry
        });

        // Call the precompile (attaching HBAR payment for creation fee)
        (int256 responseCode, address tokenAddress) = hts.createFungibleToken{value: msg.value}(
            token,
            initialSupply,
            decimals
        );

        require(responseCode == 22, "HTS: Token creation failed");
        
        userTokens[msg.sender].push(tokenAddress);
        emit TokenCreated(msg.sender, tokenAddress, name, symbol);
        
        return tokenAddress;
    }

    /**
     * @notice Mints additional supply of a token created by this contract
     */
    function mintAdditional(address tokenAddress, int64 amount) external returns (bool) {
        bytes[] memory metadata = new bytes[](0);
        
        // Call the precompile to mint additional tokens
        (int256 responseCode, uint64 newTotalSupply, ) = hts.mintToken(
            tokenAddress,
            amount,
            metadata
        );

        require(responseCode == 22, "HTS: Token minting failed");
        
        emit TokensMinted(tokenAddress, uint64(amount), newTotalSupply);
        return true;
    }

    /**
     * @notice Get tokens created by a specific user
     */
    function getUserTokens(address user) external view returns (address[] memory) {
        return userTokens[user];
    }
}
