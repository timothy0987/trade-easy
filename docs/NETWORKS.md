# Networks

## Horizen Testnet (Base Appchain)

| | |
| --- | --- |
| Network name | Horizen Testnet |
| Chain ID | `845320009` |
| RPC URL | `https://horizen-rpc-testnet.appchain.base.org` |
| Currency | ETH (18 decimals) |
| Block explorer | `https://horizen-explorer-testnet.appchain.base.org` (Blockscout) |

> Confirm these against the "Add network" prompt in the Horizen docs or
> https://chainlist.org/chain/845320009 before any deploy — one source reported the
> chain ID as `84532009`; multiple others (Chainlist, thirdweb, community) report
> `845320009`. The config uses `845320009`.

Horizen is an EVM-native L3 on Base for private onchain finance. Native privacy pieces:
- **DarkSwap** — Horizen's private DEX (with Singularity): hides asset/size/price, MEV-proof,
  composes with Aerodrome/Uniswap, supports ZK selective-disclosure proofs. → future
  `DarkSwapVenueAdapter`.
- **Vela** — TEE confidential compute (closed beta). → runs the vault agent. Request access.
- **zkVerify** — ZK proof verification. → M2 solvency / NAV / mandate-compliance proofs.

## Funding testnet ETH

Get Sepolia ETH from a public faucet, then bridge to Horizen testnet (see the Horizen
docs "How to Bridge" guide).

## Config locations

- `contracts/hardhat.config.js` — `horizenTestnet` / `horizenMainnet` networks
- `contracts/.env.example` — RPC + key env vars
- `frontend/src/components/Providers.tsx` — `horizenTestnet` wagmi chain
- `frontend/src/contracts/addresses.json` — deployed addresses (written by `deploy.js`)
