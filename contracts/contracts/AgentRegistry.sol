// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";

/**
 * @title AgentRegistry
 * @notice Tracks the autonomous trading agent for one or more PrivateTradingVaults and
 *         gates it on a fresh TEE (Vela) attestation plus a recent liveness heartbeat.
 *
 *         Trust model
 *         -----------
 *         - The agent runs inside a Vela enclave. The enclave produces an attestation
 *           document off-chain; its hash (+ a URI to the full document) is posted here by
 *           `owner` (a multisig / governance) via `acceptAttestation`.
 *         - The enclave calls `heartbeat` on a schedule to prove it is still running.
 *         - `isAgentLive()` is false if either signal goes stale. When it is false the
 *           vault refuses new trades and, after a grace period, opens emergency
 *           pro-rata redemptions so depositor funds are never trapped behind a dead agent.
 *         - Agent key rotation is timelocked so a compromised `owner` cannot instantly
 *           swap in a malicious trader.
 */
contract AgentRegistry is IAgentRegistry, Ownable {
    // --- config ---
    uint256 public attestationValidityPeriod; // max age of an accepted attestation
    uint256 public heartbeatTimeout;          // max gap between heartbeats
    uint256 public rotationDelay;             // timelock on agent key changes

    // --- state ---
    address public override agent;
    bytes32 public attestationHash;
    string  public attestationURI;
    uint256 public attestationRefreshedAt;
    uint256 public lastHeartbeat;

    address public pendingAgent;
    uint256 public pendingAgentExecuteAfter;

    error NotAgent();
    error ZeroAddress();
    error RotationNotReady();
    error NoPendingRotation();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(
        address initialOwner,
        address initialAgent,
        uint256 attestationValidityPeriod_,
        uint256 heartbeatTimeout_,
        uint256 rotationDelay_
    ) Ownable(initialOwner) {
        if (initialAgent == address(0)) revert ZeroAddress();
        agent = initialAgent;
        attestationValidityPeriod = attestationValidityPeriod_;
        heartbeatTimeout = heartbeatTimeout_;
        rotationDelay = rotationDelay_;
        // Seed timestamps so a freshly deployed registry is "live" until the first timeout.
        attestationRefreshedAt = block.timestamp;
        lastHeartbeat = block.timestamp;
    }

    // ---------------------------------------------------------------------
    // Agent liveness
    // ---------------------------------------------------------------------

    /// @notice Called by the enclave on a schedule to prove it is still running.
    function heartbeat() external onlyAgent {
        lastHeartbeat = block.timestamp;
        emit Heartbeat(msg.sender, block.timestamp);
    }

    /// @notice Governance posts the hash of the latest Vela attestation document.
    /// @param newAttestationHash keccak256 of the full attestation document
    /// @param uri               pointer to the full document (IPFS / HTTPS) for off-chain verification
    function acceptAttestation(bytes32 newAttestationHash, string calldata uri) external onlyOwner {
        attestationHash = newAttestationHash;
        attestationURI = uri;
        attestationRefreshedAt = block.timestamp;
        emit AttestationAccepted(newAttestationHash, uri, block.timestamp);
    }

    function attestationAge() public view override returns (uint256) {
        return block.timestamp - attestationRefreshedAt;
    }

    function heartbeatAge() public view returns (uint256) {
        return block.timestamp - lastHeartbeat;
    }

    function isAgentLive() public view override returns (bool) {
        return attestationAge() <= attestationValidityPeriod && heartbeatAge() <= heartbeatTimeout;
    }

    // ---------------------------------------------------------------------
    // Timelocked agent key rotation
    // ---------------------------------------------------------------------

    function proposeAgentRotation(address newAgent) external onlyOwner {
        if (newAgent == address(0)) revert ZeroAddress();
        pendingAgent = newAgent;
        pendingAgentExecuteAfter = block.timestamp + rotationDelay;
        emit AgentRotationProposed(newAgent, pendingAgentExecuteAfter);
    }

    function executeAgentRotation() external onlyOwner {
        if (pendingAgent == address(0)) revert NoPendingRotation();
        if (block.timestamp < pendingAgentExecuteAfter) revert RotationNotReady();
        address old = agent;
        agent = pendingAgent;
        pendingAgent = address(0);
        pendingAgentExecuteAfter = 0;
        // A rotation resets liveness clocks: the new enclave must attest + heartbeat.
        attestationRefreshedAt = block.timestamp;
        lastHeartbeat = block.timestamp;
        emit AgentRotated(old, agent);
    }

    function cancelAgentRotation() external onlyOwner {
        pendingAgent = address(0);
        pendingAgentExecuteAfter = 0;
    }

    // ---------------------------------------------------------------------
    // Parameter administration
    // ---------------------------------------------------------------------

    function setAttestationValidityPeriod(uint256 v) external onlyOwner {
        attestationValidityPeriod = v;
    }

    function setHeartbeatTimeout(uint256 v) external onlyOwner {
        heartbeatTimeout = v;
    }

    function setRotationDelay(uint256 v) external onlyOwner {
        rotationDelay = v;
    }
}
