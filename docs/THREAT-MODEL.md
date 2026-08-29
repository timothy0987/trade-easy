# Threat Model — Private Trading Vault

## Assets to protect

1. Depositor principal (the pooled asset + deployed positions)
2. Strategy confidentiality (params, signals, sizing, timing)
3. Depositor ledger privacy (who holds how much) — M2
4. NAV integrity (shares must be redeemable for their fair fraction)

## Actors

| Actor | Trust | Can |
| --- | --- | --- |
| Depositor | untrusted | deposit, request/claim redemption, emergency-redeem |
| Agent (enclave key) | semi-trusted, hardware-attested | `executeTrade` within mandate, `heartbeat`, process redemptions |
| Governance (`owner`, multisig) | trusted-minimized | set mandate, rotate agent (timelocked), pause, set oracle |
| Attestation poster | = governance | `acceptAttestation` |
| MEV searcher / other bots | adversarial | observe chain + mempool, sandwich, copy |

## Threats & mitigations

| # | Threat | Mitigation | Residual / TODO |
| --- | --- | --- | --- |
| T1 | Compromised agent key drains vault | Mandate caps (`maxTradeBps`, `maxDeployedBps`, allow-lists); agent can never call `transfer`/`withdraw`, only `executeTrade` into allowed venues; drawdown breaker latches `unwindOnly` | Agent can still churn within caps to bleed value via fees/slippage — M2 adds per-trade ZK mandate proof + rate limiting |
| T2 | Malicious governance swaps in an evil agent | `rotationDelay` timelock (48h) on `proposeAgentRotation` → `executeAgentRotation` | Governance can still change mandate params quickly — move mandate setters behind the timelock for mainnet |
| T3 | Agent goes offline; funds trapped | `isAgentLive()` false → no new trades; after `emergencyGracePeriod`, `declareEmergency()` is permissionless → `emergencyRedeem()` pro-rata on idle assets | Deployed positions still need governance to unwind; consider a permissionless keeper unwind path |
| T4 | Oracle manipulation inflates NAV → cheap shares / over-redemption | `IVaultOracle` abstraction; **MockOracle is testnet only** | M1 must ship a TWAP / Horizen feed with staleness + deviation checks before real funds |
| T5 | Front-running / sandwiching of vault trades | M1: `minAmountOut` on every fill; small `maxTradeBps`. M2: route through DarkSwap (hidden size/price) | M1 fills on a public AMM are still visible |
| T6 | Strategy alpha leakage | Strategy executes only inside the Vela enclave; nothing on-chain but `strategyTag` (opaque) and the resulting swap | A determined observer can still infer direction from the swap itself until M2 shielding |
| T7 | Reentrancy on deposit/withdraw/trade/claim | `nonReentrant` on all state-changing external fns; checks-effects-interactions in claim/redeem | Adapter calls out to the AMM — adapter holds no funds, verifies received balance delta |
| T8 | Redemption queue griefing / DoS | `processRedeemRequests` takes an explicit id array (no unbounded loop over all requests); shares escrowed on request | Large queues need off-chain batching by the agent |
| T9 | First-depositor share inflation | OZ ERC-4626 virtual shares/assets offset | Consider a seed deposit at deploy |
| T10 | Attestation replay / stale doc accepted | Hash + URI on-chain, `attestationRefreshedAt` timestamp, `attestationValidityPeriod` | On-chain verification of the Vela quote signature is M2 (`SolvencyVerifier`/attestation verifier) |

## Audit scope (M2)

`PrivateTradingVault`, `AgentRegistry`, `TradeEasyVenueAdapter`, the real oracle, and the
zkVerify verifier. AMM fork is in scope if it remains the production venue.
