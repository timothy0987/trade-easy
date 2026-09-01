// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ProfileRegistry
 * @notice Wallet-set display name + avatar, shared across the app. Anyone sets
 *         their own profile; nobody can set another's. The avatar is a string —
 *         a small `data:` URI (from an upload) or an https/ipfs URL. Byte caps
 *         keep a write to a single cheap tx.
 */
contract ProfileRegistry {
    struct Profile {
        string name;
        string avatarURI;
        uint64 updatedAt;
    }

    uint256 public constant MAX_NAME_BYTES = 64;
    uint256 public constant MAX_URI_BYTES = 12_000;

    mapping(address => Profile) private _profiles;
    address[] private _users;
    mapping(address => bool) private _seen;

    event ProfileUpdated(address indexed user, string name, string avatarURI);
    event ProfileCleared(address indexed user);

    error NameTooLong();
    error AvatarTooLong();

    function setProfile(string calldata name, string calldata avatarURI) external {
        if (bytes(name).length > MAX_NAME_BYTES) revert NameTooLong();
        if (bytes(avatarURI).length > MAX_URI_BYTES) revert AvatarTooLong();
        _profiles[msg.sender] = Profile(name, avatarURI, uint64(block.timestamp));
        if (!_seen[msg.sender]) {
            _seen[msg.sender] = true;
            _users.push(msg.sender);
        }
        emit ProfileUpdated(msg.sender, name, avatarURI);
    }

    function clearProfile() external {
        delete _profiles[msg.sender];
        emit ProfileCleared(msg.sender);
    }

    function getProfile(address user) external view returns (Profile memory) {
        return _profiles[user];
    }

    /// @notice Batch getter for the leaderboard — one call for every ranked wallet.
    function getProfiles(address[] calldata addrs) external view returns (Profile[] memory out) {
        out = new Profile[](addrs.length);
        for (uint256 i; i < addrs.length; ++i) out[i] = _profiles[addrs[i]];
    }

    function userCount() external view returns (uint256) {
        return _users.length;
    }

    function usersPage(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 n = _users.length;
        if (offset >= n) return new address[](0);
        uint256 end = offset + limit > n ? n : offset + limit;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) page[i - offset] = _users[i];
    }
}
