// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAgentRegistry
 * @notice On-chain source of truth for the vault's autonomous trading agent:
 *         which key it runs on, and whether its TEE (Vela) attestation is still fresh.
 *         The vault checks this before allowing any agent-initiated trade.
 */
interface IAgentRegistry {
    /// @notice The EOA the agent enclave signs trades with.
    function agent() external view returns (address);

    /// @notice True when the attestation is fresh AND the agent heartbeat is recent.
    function isAgentLive() external view returns (bool);

    /// @notice Seconds since the last accepted attestation refresh.
    function attestationAge() external view returns (uint256);

    /// @notice Emitted every time the enclave proves liveness.
    event Heartbeat(address indexed agent, uint256 timestamp);

    /// @notice Emitted when a new TEE attestation document hash is accepted.
    event AttestationAccepted(bytes32 indexed attestationHash, string uri, uint256 timestamp);

    /// @notice Emitted when an agent key rotation is queued.
    event AgentRotationProposed(address indexed newAgent, uint256 executeAfter);

    /// @notice Emitted when a queued agent key rotation takes effect.
    event AgentRotated(address indexed oldAgent, address indexed newAgent);
}
