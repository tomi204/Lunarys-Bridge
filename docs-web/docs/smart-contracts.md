---
sidebar_label: "Overview"
---

# Cross-Chain Bridge Smart Contracts

This document provides detailed information about the LUNARYS cross-chain bridge smart contracts, their functions, and how they work together to enable encrypted asset transfers between Solana and Ethereum.

## Overview

The LUNARYS bridge consists of dual blockchain deployments powered by [Arcium](https://www.arcium.com/)'s encrypted supercomputer:

- **Solana Contracts**: Built using the [Anchor framework](https://www.anchor-lang.com/) for high-throughput bridge operations
- **Ethereum Contracts**: Solidity smart contracts for secure asset validation and minting
- **Arcium MXEs**: Multiparty Computation eXecution Environments that compute on encrypted data without decryption
- **Cross-Chain Privacy**: Arcium enables the bridge to process transfer data while maintaining complete privacy

:::tip Contract Addresses
For deployed contract addresses, see the [Addresses](./addresses.md) page.
:::

## Core Functions

### init_bridge_config

Initialize bridge configuration and cross-chain parameters.

**Parameters:**

- `ctx: Context<InitBridgeConfig>` - Anchor context
- `ethereum_bridge_address: [u8; 20]` - Ethereum bridge contract address
- `min_transfer_amount: u64` - Minimum transfer amount
- `max_transfer_amount: u64` - Maximum transfer amount

**Purpose:** Sets up the bridge configuration for cross-chain operations.

### lock_assets_sol_to_eth

Lock SOL/assets on Solana for cross-chain transfer to Ethereum.

**Parameters:**

- `ctx: Context<LockAssetsSolToEth>` - Anchor context
- `amount: u64` - Amount to transfer
- `recipient: [u8; 20]` - Ethereum recipient address
- `asset_mint: Pubkey` - Asset mint (SOL or SPL token)

**Purpose:** Locks assets on Solana and initiates cross-chain transfer to Ethereum with privacy guarantees.

### lock_assets_eth_to_sol (Ethereum Contract)

Lock ETH/tokens on Ethereum for transfer to Solana.

**Parameters:**

- `amount: uint256` - Amount to transfer
- `recipient: bytes32` - Solana recipient address (32 bytes)
- `assetAddress: address` - ERC-20 token address (0x0 for ETH)

**Purpose:** Locks assets on Ethereum and emits event for cross-chain transfer to Solana with privacy preservation.

### release_assets_on_solana

Release assets on Solana after Ethereum-side validation.

**Parameters:**

- `ctx: Context<ReleaseAssetsOnSolana>` - Anchor context
- `transfer_id: [u8; 32]` - Unique transfer identifier
- `proof: BridgeProof` - Zero-knowledge proof from Ethereum validation
- `amount: u64` - Amount to release
- `recipient: Pubkey` - Solana recipient address

**Purpose:** Mints/releases equivalent assets on Solana after verifying cross-chain proof from Ethereum.

### verify_cross_chain_proof

Verify zero-knowledge proof for cross-chain transfer consistency.

**Parameters:**

- `ctx: Context<VerifyCrossChainProof>` - Anchor context
- `proof: BridgeProof` - Cryptographic proof data
- `public_inputs: Vec<u8>` - Public proof inputs
- `transfer_id: [u8; 32]` - Transfer identifier

**Purpose:** Ensures mathematical validity of cross-chain transfers without revealing sensitive data.

## Cross-Chain Privacy Mechanisms

### Encrypted Bridge Messages

Bridge communications use multiple encryption layers:

- **End-to-End Encryption**: Transfer data encrypted for destination chain
- **Zero-Knowledge Encryption**: Amounts hidden using ZK-proofs across chains
- **Inter-Chain Obfuscation**: Message routing anonymized between Solana and Ethereum

### Cryptographic Commitments

LUNARYS uses Pedersen commitments to hide transfer amounts across chains:

```
amount_commitment = g^amount * h^blinding_factor
```

### Zero-Knowledge Proofs

Arcium-powered ZK-SNARKs enable privacy-preserving cross-chain operations:

1. **Transfer Validity Proof**: Proves valid transfer without revealing amount
2. **Asset Ownership Proof**: Proves ownership without exposing holdings
3. **Cross-Chain Consistency Proof**: Ensures state consistency between chains

### Multi-Layer Encryption

Cross-chain data is encrypted using multiple techniques:

- **Recipient's Public Key**: Transfer data encrypted for destination address
- **Ephemeral Keys**: Temporary encryption for inter-chain communication
- **AES-GCM**: Symmetric encryption for bulk data transfer

## Integration with Arcium Encrypted Supercomputer

The bridge contracts integrate with [Arcium](https://www.arcium.com/) through specialized MXEs (Multiparty Computation eXecution Environments):

### How Arcium Powers LUNARYS Bridge

**MXE Configuration for Bridge Operations:**

- **Authority**: Bridge contracts can initiate encrypted computations
- **Cluster**: Selected Arcium nodes (arx) participate in cross-chain computations
- **Protocol**: MPC protocols optimized for financial transfer validation
- **IO Scheme**: Encrypted bridge data as input, zero-knowledge proofs as output
- **Computation Definition**: Bridge-specific operations on encrypted transfer data

**Arcium's Role in Privacy:**

- **Blind Processing**: Like a "blind chef" - processes transfer data without seeing amounts or recipients
- **Encrypted Validation**: Verifies transfer validity by computing on encrypted data
- **Cross-Chain Proofs**: Generates proofs that work across both Solana and Ethereum
- **Decentralized Computation**: Distributed arxOS network ensures no single point of trust

## Security Considerations

- All cryptographic operations use well-established primitives
- Zero-knowledge proofs prevent front-running attacks
- Encrypted data ensures privacy even from validators
- Decentralized architecture prevents single points of failure

## Usage Examples

### Solana to Ethereum Transfer

```rust
// Lock SOL on Solana for transfer to Ethereum
let tx = await program.methods
    .lock_assets_sol_to_eth(
        amount,
        ethereumRecipientAddress,
        NATIVE_MINT // for SOL
    )
    .accounts({
        user: userPublicKey,
        bridgeVault: bridgeVaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
```

### Ethereum to Solana Transfer

```solidity
// Lock ETH on Ethereum for transfer to Solana
function transferToSolana(uint256 amount, bytes32 solanaRecipient) external payable {
    require(msg.value == amount, "Incorrect amount");

    // Emit cross-chain transfer event with encrypted data
    emit CrossChainTransfer(
        keccak256(abi.encodePacked(msg.sender, block.timestamp)),
        amount,
        solanaRecipient,
        address(0) // ETH address
    );
}
```

### Cross-Chain Release on Solana

```rust
// Release assets on Solana after Ethereum validation
let releaseTx = await program.methods
    .release_assets_on_solana(
        transferId,
        zkProof,
        amount,
        solanaRecipient
    )
    .accounts({
        bridgeAuthority: bridgeAuthorityPDA,
        recipientTokenAccount: recipientTokenAccount,
    })
    .rpc();
```

## Error Handling

The contracts include comprehensive error handling for:

- Invalid cryptographic parameters
- Insufficient funds
- Computation failures
- Unauthorized access attempts

See the [errors documentation](./errors.md) for detailed error codes and handling.
