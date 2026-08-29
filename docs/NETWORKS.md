# Networks

## Horizen Testnet

Source: <https://horizen-2-docs.horizen.io/horizen-chain/network/testnet>

| | |
| --- | --- |
| Network name | Horizen Testnet |
| Chain ID | `2651420` |
| RPC URL (HTTPS) | `https://horizen-testnet.rpc.caldera.xyz/http` |
| RPC URL (WSS) | `wss://horizen-testnet.rpc.caldera.xyz/ws` |
| Currency | ETH (18 decimals) |
| Block explorer | `https://explorer-testnet.horizen.io` |
| Faucet | `https://hub-testnet.horizen.io` |
| Base layer | Base Sepolia |

Horizen Testnet runs on Base Sepolia. Native privacy pieces:
- **DarkSwap** — Horizen's private DEX (with Singularity): hides asset/size/price, MEV-proof,
  composes with Aerodrome/Uniswap, supports ZK selective-disclosure proofs. → future
  `DarkSwapVenueAdapter`.
- **Vela** — TEE confidential compute (closed beta). → runs the vault agent. Request access.
- **zkVerify** — ZK proof verification. → M2 solvency / NAV / mandate-compliance proofs.

## Funding testnet ETH

Use the Horizen testnet hub faucet: <https://hub-testnet.horizen.io>. It dispenses the
ETH used for gas on Horizen Testnet (Base Sepolia).

## Config locations

- `contracts/hardhat.config.js` — `horizenTestnet` / `horizenMainnet` networks
- `contracts/.env.example` — RPC + key env vars
- `frontend/src/components/Providers.tsx` — `horizenTestnet` wagmi chain
- `frontend/src/contracts/addresses.json` — deployed addresses (written by `deploy.js`)
