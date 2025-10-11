---
sidebar_label: "Architecture"
---

# Cross-Chain Bridge Architecture

This document describes the architecture of the LUNARYS encrypted cross-chain bridge between Solana and Ethereum.

## System Overview

LUNARYS is a decentralized cross-chain bridge that enables secure and private asset transfers between Solana and Ethereum networks. Powered by [Arcium](https://www.arcium.com/) - the encrypted supercomputer - the bridge can compute on encrypted data without ever decrypting it, enabling true privacy-preserving cross-chain operations.

### High-Level Architecture

The following diagram provides a simplified overview of how LUNARYS connects different blockchain networks through encrypted computation:

![LUNARYS Simple Architecture](/img/diagram-simple.png)

The architecture consists of three main layers:

- **User Interface Layer**: Bridge frontend applications for user interactions
- **Privacy Layer**: Arcium encrypted supercomputer for secure processing
- **Blockchain Layer**: Smart contracts on Solana and Ethereum networks
- **Communication Layer**: Cross-chain relayer network for secure message passing

## Core Components

### 1. Cross-Chain Smart Contracts

Dual blockchain deployment with native protocols:

#### Solana Contracts (Anchor Programs)

- **Bridge Logic**: Handles asset locking and cross-chain communication
- **Privacy Management**: Manages encrypted transfer data and ZK-proofs
- **State Synchronization**: Maintains bridge state and transfer records

#### Ethereum Contracts (Solidity)

- **Asset Management**: ERC-20/ERC-721 token minting and burning
- **Bridge Validation**: Verifies cross-chain proofs and releases assets
- **Security Modules**: Multi-signature and timelock mechanisms

**Location**: `contracts/` directory

### 2. Cross-Chain Relayer Network

Decentralized infrastructure managing inter-chain communication:

- **Message Passing**: Secure transmission of encrypted bridge data
- **Proof Verification**: Validates zero-knowledge proofs across chains
- **State Synchronization**: Ensures consistency between Solana and Ethereum states
- **Privacy Preservation**: Processes encrypted data without decryption

**Location**: `relayer/` directory

### 3. Bridge Frontend Applications

Multi-chain user interfaces:

- **Unified Interface**: Single application for both Solana and Ethereum operations
- **Wallet Integration**: MetaMask, Phantom, and other wallet support
- **Transfer Monitoring**: Real-time tracking of cross-chain transfers
- **Bridge Analytics**: Historical data and performance metrics

**Location**: `frontend/` directory

### 4. Arcium Encrypted Supercomputer

[Arcium](https://www.arcium.com/) - the encrypted supercomputer powering LUNARYS privacy:

- **Multiparty Computation eXecution Environments (MXEs)**: Configurable virtual machines for encrypted computations
- **Encrypted Processing**: Compute on data without ever decrypting it (like a "blind chef" cooking with hidden ingredients)
- **Cross-Chain Privacy Circuits**: Specialized circuits for bridge operations that maintain privacy across chains
- **Zero-Knowledge Proofs**: Cryptographic proofs that verify operations without revealing sensitive data
- **Decentralized Network**: Distributed arxOS nodes providing the computational power

## Cross-Chain Transfer Flow

The complete flow of a cross-chain bridge transfer involves multiple coordinated steps across both blockchains and the encrypted computation layer:

![LUNARYS Complete Architecture Flow](/img/diagram-full.png)

This detailed diagram illustrates the end-to-end journey of a bridge transaction, from user initiation through encrypted processing to final asset delivery on the destination chain.

### Bridge Transfer Initiation

1. **User Selection**: User chooses source chain, destination chain, and assets
2. **Amount Specification**: Transfer amount specified with privacy requirements
3. **Wallet Connection**: Connect source chain wallet (MetaMask for ETH, Phantom for SOL)
4. **Approval**: Grant bridge contract permission to lock assets

### Privacy Layer Processing

1. **Asset Encryption**: Transfer details encrypted using zero-knowledge techniques
2. **Proof Generation**: Arcium generates ZK-proofs for transfer validity
3. **Commitment Creation**: Pedersen commitments hide sensitive transfer data
4. **Cross-Chain Message**: Encrypted data prepared for inter-chain communication

### Cross-Chain Execution

#### Source Chain (Lock Phase)

1. **Asset Locking**: Assets locked in bridge contract on source chain
2. **Event Emission**: Bridge event emitted with encrypted transfer data
3. **State Recording**: Transfer state recorded with cryptographic proofs

#### Inter-Chain Communication

1. **Message Relay**: Relayers transmit encrypted bridge messages
2. **Proof Verification**: Zero-knowledge proofs validated across chains
3. **State Synchronization**: Bridge states synchronized between chains

#### Destination Chain (Release Phase)

1. **Proof Verification**: Destination chain verifies source chain proofs
2. **Asset Minting**: Equivalent assets minted on destination chain
3. **Transfer Completion**: Assets released to recipient address

## Privacy Mechanisms

### Cross-Chain Privacy Techniques

#### Encrypted Bridge Communications

Multi-layer encryption for cross-chain messages:

- **End-to-End Encryption**: Transfer data encrypted for destination chain
- **Zero-Knowledge Encryption**: Amounts hidden using ZK-proofs across chains
- **Inter-Chain Obfuscation**: Message routing anonymized between Solana and Ethereum

#### Pedersen Commitments

Used to hide transfer amounts across chains:

```
C = g^amount * h^blinding_factor
```

- `g`, `h`: Generator points on elliptic curve
- `amount`: Transfer amount (cryptographically hidden)
- `blinding_factor`: Random value ensuring privacy

#### Arcium Encrypted Computation

[Arcium](https://www.arcium.com/) enables computation on encrypted data through Multiparty Computation (MPC):

**How Arcium Works:**

- **MXEs (Multiparty computation eXecution Environments)**: Virtual machines that define encrypted computation parameters
- **Blind Processing**: Like a chef cooking without seeing ingredients - computations happen on encrypted data
- **Distributed Execution**: arxOS network of nodes collaboratively processes encrypted computations
- **Configurable Trust**: Developers can customize trust assumptions and protocols

**Bridge-Specific Encrypted Operations:**

1. **Encrypted Transfer Validation**: Validates transfers by computing on encrypted amounts
2. **Privacy-Preserving Ownership**: Proves asset ownership without revealing balances
3. **Cross-Chain State Verification**: Ensures consistency between chains using encrypted proofs
4. **Zero-Knowledge Verification**: Mathematical guarantees without data exposure

#### Multi-Layer Encryption

##### Inter-Chain Messages

```
encrypted_bridge_data = ZK_Encrypt(transfer_details, destination_chain_key)
```

##### Asset Transfer Data

```
transfer_ciphertext = Encrypt(amount_commitment, routing_metadata)
```

## Security Model

### Cross-Chain Threat Model

LUNARYS protects against cross-chain attacks:

- **Bridge Frontrunning**: ZK-proofs prevent observation-based attacks
- **Cross-Chain Censorship**: Decentralized relayers prevent single points of failure
- **Asset Theft**: Multi-signature and timelock mechanisms on both chains
- **State Inconsistency**: Cryptographic proofs ensure cross-chain consistency
- **Privacy Breaches**: Zero-knowledge techniques protect transfer metadata

### Trust Assumptions

- **Dual Network Security**: Honest majority on both Solana and Ethereum
- **Arcium Framework**: Correct ZK-circuit implementation across chains
- **Cryptographic Primitives**: Standard assumptions for both ecosystems
- **Relayer Network**: Sufficient decentralization of message passing
- **Multi-Sig Security**: Secure key management for bridge administration

## Scalability Considerations

### Cross-Chain Throughput

- **Solana Source Chain**: ~65,000 TPS for fast transfer initiation
- **Ethereum Destination Chain**: Secure validation with robust finality
- **Hybrid Performance**: Optimized for both speed and security

### Arcium Cross-Chain Optimization

- **Batch Bridging**: Multiple transfers processed together
- **Parallel Proof Generation**: Concurrent ZK-proofs across chains
- **Efficient Cross-Chain Circuits**: Optimized ZK-SNARKs for bridge operations

## Deployment Architecture

### Development Environment

- Local Solana validator and Ethereum testnet (Sepolia/Holesky)
- Arcium development framework for cross-chain testing
- Integrated cross-chain testing suite with privacy verification

### Production Environment

- Mainnet Solana and Ethereum deployments
- Decentralized cross-chain relayer network
- Multi-region, multi-chain frontend hosting

## Integration Points

### External Services

- **Solana RPC**: Source chain interaction and transaction submission
- **Ethereum RPC**: Destination chain validation and asset minting
- **Arcium API**: Cross-chain zero-knowledge computation requests
- **Multi-Chain Wallets**: MetaMask, Phantom, and cross-chain wallet support

### API Interfaces

- **REST APIs**: Cross-chain relayer communication and bridge status
- **WebSocket**: Real-time cross-chain transfer updates
- **GraphQL**: Complex multi-chain queries and analytics

## Monitoring and Observability

### Cross-Chain Metrics

- Bridge transfer success rates across chains
- Cross-chain confirmation times (Solana → Ethereum)
- Privacy guarantee verification for transfers
- Multi-chain system performance and latency metrics

### Logging

- Structured event logging
- Error tracking and alerting
- Audit trails for compliance

## Future Extensions

### Planned Features

- **Additional Chains**: Polygon, Arbitrum, and other EVM-compatible chains
- **Enhanced Privacy**: Ring signatures and bulletproofs for improved anonymity
- **DeFi Composability**: Cross-chain lending, AMMs, and yield farming
- **NFT Bridges**: Private NFT transfers between Solana and Ethereum
- **Layer 2 Integration**: Optimistic and ZK-rollup bridge support

This architecture provides a solid foundation for encrypted cross-chain asset transfers while maintaining privacy, security, and interoperability between Solana and Ethereum ecosystems.
