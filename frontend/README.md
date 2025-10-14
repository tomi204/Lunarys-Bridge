## Lunarys Bridge – Overview

This repository hosts the Lunarys frontend, the primary interface for bridging assets between Solana and EVM networks with fully homomorphic encryption (FHE). The product couples high-throughput routing with policy enforcement so institutions can move liquidity privately without sacrificing compliance.

The frontend is written in Next.js App Router and communicates with three core backend components:

- **Encrypted node gateways** that accept wallet payloads, bundle proofs, and hand off encrypted instructions to the relayer mesh.
- **The relayer network** (Rust) that verifies policy attestations, monitors origin/destination finality, and submits unlock transactions once quorum is met.
- **Settlement contracts** on Solana and EVM that custody assets, validate FHE proofs, and release funds when the relayer network signs off.

## How bridging works

1. **Wallet session & encryption**  
   Users connect either an EVM wallet or Solana wallet through Reown AppKit. The frontend obtains an FHE public key from the node gateway and encrypts the destination details locally. Plaintext destination data never leaves the browser.

2. **Policy evaluation**  
   The encrypted payload, alongside zero-knowledge attestations, is forwarded to the Lunarys policy virtual machine. Policy packs decide whether the transfer satisfies configured limits (jurisdictions, daily caps, counterparty allowlists, etc.) without revealing the underlying addresses.

3. **Relayer confirmations**  
   Once policies pass, the payload enters the relayer queue. Independent relayer nodes watch both chains and only sign the release transaction when:
   - Required confirmations on the origin chain are observed,
   - Policy receipts match the encrypted payload hash,
   - Hardware attestation from each relayer remains valid.

   Threshold signatures coming from enclave-protected keys authorize the settlement contract to release funds.

4. **Settlement & audit trail**  
   The settlement contract decrypts the payload just long enough to direct funds to the correct destination. A zero-knowledge receipt is pushed on-chain and mirrored in the Command Center so operations teams have verifiable logs without exposing counterparties.

## Node & relayer architecture

- **Gateway nodes**  
  Run inside SGX-enabled environments, terminate TLS, and provide FHE key material. Gateways stream encrypted payloads to relayers via gRPC and handle rate limiting and DDoS protection.

- **Relayer mesh**  
  Multi-region cluster running Rust services. Uses Raft-style consensus to agree on transaction readiness, then produces a threshold signature destined for the settlement contract. Relayers expose health metrics and are continuously audited.

- **Settlement contracts**  
  Solana and EVM contracts written in Rust / Solidity. Contracts validate threshold signatures, verify ZK receipts, and enforce policy pack outcomes. They hold no long-lived plaintext data; encryption artifacts are deleted after execution.

## Encryption posture

- All sensitive routing info is encrypted with Zama’s FHEVM primitives before leaving the user's device.
- Payloads remain encrypted through policy evaluation, relayer transport, and contract execution.
- Audit trails rely on blinded metadata—operators see outcome proofs, not underlying wallet addresses.
- No user-identifying information is stored in the frontend or backend databases.

## Local development

```bash
npm install
npm run dev
# open http://localhost:3000
```

Useful scripts:

| Command | Purpose |
|---------|---------|
| `npm run dev` | Launch Next.js in Turbopack mode |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint across the workspace |

### Environment variables

Create `.env.local` and provide:

```
NEXT_PUBLIC_REOWN_PROJECT_ID=<your-reown-cloud-project-id>
```

All other configuration (RPC URLs, relayer endpoints, policy metadata) is injected via the node gateway during runtime.

## Folder structure

- `app/` – Next.js App Router pages, marketing content, bridge flow, and legal center.
- `components/` – Shared UI primitives, wallet modals, marketing layouts.
- `hooks/` – Reown wallet adapters for Solana and EVM.
- `providers/` – Context for FHE bridge operations and encrypted workflow helpers.
- `lib/` – Utility libraries and helpers for encryption, contracts, and constants.

## Operational checklists

- Run `npm run lint` before committing changes.
- Keep marketing/legal content synchronized with the latest audit and compliance updates.
- Bridge flow tests should be executed against the sandbox relayer once per feature.

## Support

- Security or compliance questions: `security@lunarys.io`
- Integration guidance: `integrations@lunarys.io`
- General inquiries: `hello@lunarys.io`
