# Private Trading Vault — Spec (M1 scaffold)

**Horizen Ecosystem Fund S2 · Category 1 RFP: _private agentic trading vaults_**

## One-liner

Depositors pool a single asset into an ERC-4626 vault. An autonomous agent running in a
Vela TEE trades the pool on Horizen venues under an on-chain mandate. Strategy logic,
parameters, and timing stay inside the enclave; positions become verifiable-but-not-
front-runnable at M2 via committed NAV + zkVerify proofs.

## Components (this repo)

| Contract | Role |
| --- | --- |
| `PrivateTradingVault` | ERC-4626 shares; deposit/withdraw; redemption queue for deployed capital; agent trade entrypoint with mandate enforcement; drawdown circuit breaker; emergency pro-rata exit. |
| `AgentRegistry` | Holds the agent key; gates trading on a fresh Vela attestation hash + liveness heartbeat; timelocked key rotation. |
| `ITradeVenue` + `TradeEasyVenueAdapter` | Uniform swap interface. M1 routes through the local constant-product AMM (self-contained liquidity). M2 adds `DarkSwapVenueAdapter` for venue-layer execution privacy. |
| `IVaultOracle` + `MockOracle` | Prices non-asset holdings for NAV. M1 replaces the mock with a TWAP feed. |
| `ZenStakingPool` | ZEN stakers earn a pro-rata share of the vault fee shares routed here (`stakingFeeShareBps`). MasterChef-style accumulator; rewards arrive as direct ERC-20 transfers from the vault. Swappable for Horizen's canonical staking pool via `vault.setFeeRecipients`. |
| `TradeEasyFactory/Pair/Router` | The AMM venue (pre-existing Uniswap-V2 fork, kept). |

## Mandate (governance-set, agent cannot change)

- `isAllowedToken` / `isAllowedVenue` allow-lists
- `maxTradeBps` — per-trade notional cap vs NAV (default 20%)
- `maxDeployedBps` — cap on total non-asset value vs NAV (default 80%)
- `maxDrawdownBps` — drop from high-water price/share that latches `unwindOnly` (default 15%)
- `depositCap`, `emergencyGracePeriod`

## Fees

Charged by **minting shares** to the recipients (dilution), settled lazily on every
deposit / withdrawal / redemption settlement / trade, or via `accrueFees()`.

- `managementFeeBps` — annualized on NAV (cap 5%/yr, default 2%)
- `performanceFeeBps` — cut of any gain above `highWaterPricePerShare` (cap 30%, default 20%);
  the HWM ratchets on accrual so the same gain is never charged twice
- `stakingFeeShareBps` — slice of **every** accrued fee routed to `stakingPool` (the
  `ZenStakingPool`), for the M3 fee-share requirement (default 17.5%); rest goes to
  `feeRecipient`. Wire it with `deploy:staking` / `vault.setFeeRecipients`.
- Accrual **freezes** while `emergency` is latched
- `previewAccruedFeeShares()` — view of what would be minted right now

## Agent lifecycle

1. Enclave boots, produces a Vela attestation. Governance posts its hash + URI via
   `AgentRegistry.acceptAttestation`.
2. Enclave calls `heartbeat()` on a schedule.
3. `executeTrade(...)` requires `isAgentLive()` (fresh attestation **and** recent heartbeat),
   `!paused`, `!emergency`, mandate checks pass.
4. If attestation/heartbeat goes stale → trading blocked. After `emergencyGracePeriod`,
   anyone calls `declareEmergency()` → vault pauses, depositors `emergencyRedeem()` pro-rata
   against idle assets. Governance unwinds deployed positions.
5. Key rotation is timelocked (`rotationDelay`, default 48h) and resets liveness clocks.

## Withdrawals

- Standard ERC-4626 `withdraw`/`redeem` succeed only up to **idle** asset balance.
- Beyond that: `requestRedeem(shares)` escrows shares → agent/owner unwinds → 
  `processRedeemRequests(ids)` fixes `assetsOwed` at NAV and burns shares → `claimRedeem(id)`.

## Privacy roadmap

| Milestone | Privacy delivered |
| --- | --- |
| **M1** | Strategy runs in the enclave: params, signal thresholds, sizing, and timing are never on-chain or in any server the operator controls. `strategyTag` per trade is an opaque label. |
| **M2** | `SolvencyVerifier` consumes zkVerify receipts: prove `Σshares · NAV == assets`, solvency, and per-trade mandate compliance **without revealing positions**. Depositor ledger shielded. `strategyTag` becomes a commitment to the encrypted rationale. Fills route through `DarkSwapVenueAdapter` (hidden size/price, MEV-proof). |
| **M3** | Mainnet; usage metrics; fee-share to the ZEN staking pool — `ZenStakingPool` deployed and wired via `stakingFeeShareBps` (default 17.5%), swappable for Horizen's canonical pool. |

## What's explicitly NOT done in this scaffold

- Real oracle (uses `MockOracle`) — M1 task: TWAP over the AMM or a Horizen feed.
- No per-depositor compliance gate (PureFi hook) — placeholder only.
- Privacy is roadmap, not yet implemented — M1 demo shows enclave-run strategy, not shielded state.
- `page.tsx` (mint/swap UI) still needs replacing with depositor + manager views.
