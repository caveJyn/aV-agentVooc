# 🔌 plugin-xverse

`plugin-xverse` is a modular plugin for **ElizaOS** that integrates the [Xverse Wallet](https://www.xverse.app/) with **Starknet Cairo compute**.  
It enables Bitcoin wallet connections, secure transaction signing, and off-loading arbitrary calculations to Starknet smart contracts.  
Final results can be optionally **emailed to users** using the existing `plugin-email`.

---

## ✨ Features

- **Wallet Integration**
  - Connect to Xverse wallet from the frontend.
  - Retrieve wallet addresses (BTC, STX, ordinals, etc.).
  - Request transaction signatures.
  - Manage session securely.

- **Starknet Cairo Compute**
  - Off-source arbitrary calculations (math problems, simulations, financial formulas).
  - Use Cairo smart contracts for verified results.
  - Support batching of compute tasks.

- **Cross-Plugin Interoperability**
  - Forward results to `plugin-email` → Email users the final verified outputs.
  - Sync with `plugin-sanity` → Persist user session, character, or history.

- **Utility Helpers**
  - Transaction templates for Bitcoin & Starknet.
  - Crypto utilities for formatting & verification.
  - Logging + error handling consistent with other plugins.

---

## Setup
1. `cd packages/plugin-xverse && pnpm install`
2. Add to Sanity character: `"plugins": ["xverse"]`
3. Set env: `XVERSE_API_KEY=...`
4. Build: `pnpm build`


## Usage
- Connect: `connect_wallet`
- Sign: `sign_message`
- Build PSBT: `build_psbt`
- Calculate: `perform_calculation`

## Usage Flow
- Agent calls `connect_wallet` → Returns address/balance.
- `perform_calculation` → e.g., {type: "fee_estimate", amountSats: 500} → {value: 120, provenance: {...}}
- `build_psbt` → Builds/signs/broadcasts, emails receipt.

## Security
- No privkeys; Sats Connect only.
- Validate UTXOs; rate-limit PSBTs.
- Emails: Tx hash + calc summary only.

## Roadmap
- Runes read (action).
- Atomiq swap (extend buildPsbt).
- On-chain Cairo verify.



## 📦 Installation

Inside your monorepo:

```bash
cd packages/plugin-xverse && pnpm install


### Hackathon Notes
- For the hackathon, the `CONNECT_WALLET`, `SIGN_MESSAGE`, and `BUILD_PSBT` actions are mocked in Node.js to bypass the browser-only `sats-connect` modal. This returns simulated wallet addresses, signatures, and transaction hashes.
- In production, the `sats-connect` modal will be integrated into a web/mobile frontend, using `@sats-connect/ui` to display the Xverse connection prompt.
- To test the browser flow, deploy the plugin with a frontend (e.g., Next.js or React Native) and ensure `sats-connect` is loaded in a browser environment.


Chipi Stack Integration: The backend must integrate with the Chipi Stack API for Starknet wallet operations. Ensure the @chipi-stack/chipi-react package or its backend equivalent is available or replaced with direct API calls to the Chipi service (assumed to be at https://api.chipi.io based on typical API patterns).
Environment Variables: Add CHIPI_API_KEY to your environment variables for authenticating with the Chipi API.
Authentication: Use SuperTokens for session validation, consistent with existing endpoints.
Sanity Integration: Store wallet information (e.g., wallet address, encrypted private key) in Sanity under the User or a new Wallet schema.
USDC Contract: The USDC contract address is provided as 0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8.
VESU Contract: The VESU contract address for staking is 0x037ae3f583c8d644b7556c93a04b83b52fa96159b2b0cbd83c14d3122aef80a2.





























# Plugin Starknet

Starknet L2 plugin with Chipi Pay for wallets/payments and Atomiq DEX roadmap.

## Env Vars (Validated via Zod)
- `STARKNET_ADDRESS`: Required
- `STARKNET_PRIVATE_KEY`: Required (sensitive)
- `STARKNET_RPC_URL`: Default: https://rpc.starknet.lava.build
- `CHIPI_PUBLIC_API_KEY`: Required for Chipi Pay
- `CHIPI_SECRET_KEY`: Required (sensitive)
- `SCARB_PATH`: Default: scarb
- `USDC_ADDRESS`: Default: 0x...
- `VESU_ADDRESS`: Default: 0x...

## Chipi Pay Integration
Uses Chipi SDK for non-custodial wallets, USDC transfers, staking.

## Atomiq DEX Roadmap
Upcoming: Cross-chain swaps (BTC/Starknet) via Atomiq API.

## Usage
See actions/providers for details.