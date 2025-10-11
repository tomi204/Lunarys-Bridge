---
sidebar_label: "Privacy Protocol"
---

# Privacy Protocol

This document details the privacy mechanisms and cryptographic protocols used in LUNARYS to ensure transaction privacy while maintaining security and decentralization.

## Privacy Goals

LUNARYS aims to achieve the following privacy properties:

- **Amount Privacy**: Transaction amounts are hidden from public view
- **Recipient Privacy**: Recipients cannot be linked to transactions publicly
- **Sender Privacy**: Senders remain anonymous in the transaction graph
- **Unlinkability**: Transactions cannot be linked to each other
- **Balance Privacy**: Account balances remain hidden

## Cryptographic Building Blocks

### Pedersen Commitments

Pedersen commitments provide hiding and binding properties for amount privacy:

**Commitment Generation:**

```
C = g^value * h^random
```

Where:

- `g`, `h` are generator points on the elliptic curve
- `value` is the committed amount
- `random` is a random blinding factor

**Properties:**

- **Hiding**: Given `C`, it's computationally infeasible to determine `value`
- **Binding**: It's computationally infeasible to find two different `(value, random)` pairs that produce the same `C`

### Arcium Encrypted Computation

LUNARYS uses [Arcium](https://www.arcium.com/) - the encrypted supercomputer - to perform computations on encrypted data without ever decrypting it. Arcium combines Multiparty Computation (MPC), Zero-Knowledge Proofs (ZKPs), and other cryptographic techniques to enable privacy-preserving operations.

**How Arcium Enables Privacy:**

1. **Encrypted Computation**: Arcium's MXEs (Multiparty Computation eXecution Environments) process encrypted transfer data
2. **Blind Processing**: Like a "blind chef" - computations happen without seeing the actual data
3. **Distributed Validation**: Multiple arx nodes collaboratively verify operations without data exposure
4. **Zero-Knowledge Proofs**: Mathematical proofs that validate operations without revealing sensitive information

**Bridge-Specific Privacy Operations:**

1. **Encrypted Transfer Validation**: Validates cross-chain transfers by computing on encrypted amounts
2. **Privacy-Preserving Balance Checks**: Verifies sufficient balance without revealing actual balances
3. **Cross-Chain Consistency**: Ensures bridge state consistency using encrypted proofs

### Encryption Schemes

#### Public Key Encryption

Transaction data is encrypted using recipient's public key:

```
ciphertext = Encrypt(recipient_public_key, plaintext_data)
```

#### Symmetric Encryption

For temporary data storage and communication:

```
ciphertext = AES-GCM(key, plaintext, associated_data)
```

## Privacy Protocol Flow

### 1. Transaction Preparation

**User Side:**

1. Generate random blinding factor `r`
2. Create Pedersen commitment: `C = g^amount * h^r`
3. Encrypt transaction data with recipient's public key
4. Sign transaction with user's private key

**Data Structure:**

```rust
struct EncryptedTransaction {
    amount_commitment: [u8; 32],    // Pedersen commitment
    recipient_ciphertext: Vec<u8>,  // Encrypted recipient data
    amount_ciphertext: Vec<u8>,     // Encrypted amount data
    nonce: u128,                    // Uniqueness nonce
    signature: Signature,           // User signature
}
```

### 2. Computation Phase

**Arcium Processing:**

1. Receive encrypted transaction data
2. Execute ZK-circuit on encrypted inputs
3. Generate proof of correct computation
4. Return computation results with proof

**ZK-Circuit Operations:**

- Verify amount range proofs
- Check balance constraints
- Validate payout conditions
- Generate payout instructions

### 3. Execution Phase

**Smart Contract:**

1. Verify ZK-proof from Arcium
2. Decrypt computation results (if needed)
3. Execute token transfers
4. Update internal state

## Privacy Attacks and Mitigations

### Linkability Attacks

**Attack:** Correlate transactions through timing or metadata

**Mitigations:**

- Transaction batching to obscure timing
- Random delays in processing
- Metadata stripping

### Amount Inference Attacks

**Attack:** Infer amounts through side channels

**Mitigations:**

- Fixed-size ciphertext padding
- Commitment randomization
- Range proof verification

### Front-running Attacks

**Attack:** Observe and preempt transactions

**Mitigations:**

- ZK-proofs prevent front-running
- Encrypted transaction queuing
- Random execution ordering

## Anonymity Set

The anonymity set represents the group of possible transaction participants:

- **Initial Set**: All system users
- **Active Set**: Users who have transacted recently
- **Temporal Set**: Users active in the same time window

**Enhancing Anonymity:**

- Regular "dummy" transactions
- Cross-group mixing
- Time-based batching

## Balance Privacy

### Hidden Balances

Account balances are never stored on-chain in plaintext:

- **Commitment-based**: Balances represented as commitments
- **ZK-updates**: Balance changes proven without revealing amounts
- **Range proofs**: Prevent negative balances cryptographically

### Balance Verification

```rust
// Balance update with ZK-proof
new_balance_commitment = old_balance_commitment * g^amount_change
proof = ProveKnowledgeOfBalanceUpdate(old_commitment, new_commitment, amount_change)
```

## Recipient Privacy

### Encrypted Recipient Identification

Recipients are identified through:

1. **Encrypted Tags**: Recipient identifiers encrypted with their public key
2. **Hash-based Lookup**: Recipients prove ownership through ZK-proofs
3. **Anonymous Addressing**: No direct address exposure

### Payout Mechanism

```
recipient_proof = ProveKnowledgeOfRecipientTag(tag_commitment, decryption_key)
payout_execution = VerifyProofAndExecuteTransfer(proof, amount)
```

## Performance Considerations

### Computation Costs

- **Commitment Generation**: ~1ms per commitment
- **ZK-proof Creation**: ~100-500ms per proof
- **Verification**: ~10-50ms per verification

### Scalability

- **Batch Processing**: Process multiple transactions together
- **Parallel Computation**: Concurrent ZK-proof generation
- **Caching**: Reuse common cryptographic material

## Compliance and Regulation

### Regulatory Considerations

While maintaining privacy, LUNARYS supports:

- **KYC Integration**: Optional identity verification
- **Transaction Monitoring**: Configurable privacy levels
- **Audit Trails**: Privacy-preserving compliance proofs

### Privacy vs Compliance Balance

```
Privacy Level: Maximum ↔ Minimum
Compliance:   Minimum ↔ Maximum
```

Users can choose their preferred balance based on needs.

## Future Privacy Enhancements

### Advanced Cryptographic Primitives

- **Bulletproofs**: Shorter, more efficient range proofs
- **Ring Signatures**: Enhanced sender anonymity
- **Multi-party Computation**: Distributed privacy

### Network-level Privacy

- **Tor Integration**: Network traffic anonymization
- **Mix Networks**: Transaction mixing services
- **Decoy Traffic**: Additional privacy through noise

## Implementation Security

### Cryptographic Security

- **Standard Primitives**: Uses well-analyzed cryptographic constructions
- **Secure Parameters**: Conservative parameter choices
- **Regular Audits**: Third-party cryptographic review

### Protocol Security

- **Formal Verification**: Key components formally verified
- **Security Reviews**: Regular security assessments
- **Bug Bounties**: Community-driven security testing

This privacy protocol ensures that LUNARYS provides strong privacy guarantees while maintaining the security and efficiency required for a production payment system.
