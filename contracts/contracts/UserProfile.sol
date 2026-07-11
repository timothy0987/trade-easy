// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UserProfile {
    mapping(address => string) public usernames;

    event UsernameSet(address indexed user, string name);

    function setUsername(string memory _name) external {
        usernames[msg.sender] = _name;
        emit UsernameSet(msg.sender, _name);
    }
}
