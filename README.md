# Private Trading Vault (Horizen)

Horizen Ecosystem Fund S2 — Category 1 RFP: **private agentic trading vaults**.

Depositors pool a single asset into an ERC-4626 vault. An autonomous agent — designed
to run inside a Vela TEE — trades the pool on Horizen venues under an on-chain mandate.
A configurable slice of protocol fees is routed to a ZEN staking pool.

> **Status:** M1 scaffold. Vault mechanics, mandate, fee-share, and emergency exit are
> built, tested, and deployed on Horizen testnet. The privacy layer (TEE-run strategy,
> on-chain attestation verification, zkVerify solvency proofs) is the M1 deliverable and
> is **not yet implemented** — see [`docs/SPEC.md`](docs/SPEC.md).

## Layout

```
contracts/
  contracts/
    PrivateTradingVault.sol   ERC-4626 vault: deposits→shares, agent-only trading under a
                              mandate (per-trade / deployed caps, drawdown breaker),
                              redemption queue, mgmt+perf fees, permissionless emergency exit
    AgentRegistry.sol         agent key + attestation-hash liveness gate + timelocked rotation
    ZenStakingPool.sol        ZEN stakers earn a pro-rata share of the vault's fee shares
    TokenVendor.sol           fixed-rate ETH/USDC/ZEN venue the agent swaps against
    TradeEasy{Factory,Pair,Router}.sol   constant-product AMM (secondary venue)
    adapters/  interfaces/  mocks/
  scripts/    deployVault.js · deployStaking.js · deployZenSwap.js · fundContracts.js
  test/       24 passing
frontend/     Next.js — /vault (depositor + manager) and /trade (the venue)
docs/         SPEC.md · THREAT-MODEL.md · NETWORKS.md
```

## Quick start

```bash
cd contracts && npm install && npm run compile && npm test
```

Deploy (set `PRIVATE_KEY` in `contracts/.env`, fund it via the Horizen testnet hub):

```bash
npm run deploy:vault      # vault + registry + oracle + AMM venue + adapter
npm run deploy:staking    # ZenStakingPool, wired via setFeeRecipients
npm run deploy:venue      # USDC + ZEN mocks + generic TokenVendor
npm run fund              # ETH to the vendor for token→ETH swaps
```

```bash
cd frontend && npm install && npm run dev
```

Network params: [`docs/NETWORKS.md`](docs/NETWORKS.md) (Horizen Testnet, chain 2651420).
