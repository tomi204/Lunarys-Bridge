---
sidebar_position: 5
---

# API Reference

This document provides API reference for LUNARYS smart contracts and integration points.

## Program ID

```
AfaF8Qe6ZR9kiGhBzJjuyLp6gmBwc7gZBivGhHzxN1by
```

## Core Functions

### init_plan_payout_comp_def

Initialize a payout computation definition.

**Parameters:**

- `ctx: Context<InitPlanPayoutCompDef>` - Anchor context

### queue_plan_payout

Queue a payout computation request.

**Parameters:**

- `computation_offset: u64` - Offset for computation scheduling
- `pub_key: [u8; 32]` - Public key for encryption
- `nonce: u128` - Unique nonce for the transaction
- `amount_ct: [u8; 32]` - Encrypted amount ciphertext
- `recipient_tag_ct: [u8; 32]` - Encrypted recipient tag ciphertext

### deposit_and_queue

Deposit tokens and queue computation atomically.

**Parameters:**

- `computation_offset: u64` - Computation scheduling offset
- `amount_ct: [u8; 32]` - Encrypted amount
- `recipient_tag_ct: [u8; 32]` - Encrypted recipient tag
- `pub_key: [u8; 32]` - Public key for encryption
- `nonce: u128` - Transaction nonce
- `amount_commitment: [u8; 32]` - Pedersen commitment to amount
- `recipient_hash: [u8; 32]` - Hash of recipient information
- `amount: u64` - Actual deposit amount

### deposit_sol_and_queue

Deposit SOL and queue computation.

**Parameters:**

- `computation_offset: u64` - Computation offset
- `amount_ct: [u8; 32]` - Encrypted amount
- `recipient_tag_ct: [u8; 32]` - Encrypted recipient tag
- `pub_key: [u8; 32]` - Encryption public key
- `nonce: u128` - Transaction nonce
- `amount_commitment: [u8; 32]` - Amount commitment
- `recipient_hash: [u8; 32]` - Recipient hash
- `lamports: u64` - Amount of SOL to deposit

### plan_payout_callback

Process Arcium computation results.

**Parameters:**

- `ctx: Context<PlanPayoutCallback>` - Anchor context
- `output: ComputationOutputs<PlanPayoutOutput>` - Arcium computation results

## SDK Usage

### Installation

```bash
npm install @lunarys/sdk
```

### Basic Usage

```typescript
import { Lunarys } from "@lunarys/sdk";

const lunarys = new Lunarys(connection);

// Create payment
const payment = await lunarys.createPayment({
  amount: 1000000,
  recipient: recipientPublicKey,
});

// Submit payment
const paymentId = await lunarys.submitPayment(payment);
```

This API reference provides the foundation for integrating with LUNARYS. For more detailed examples and advanced usage patterns, check our GitHub repository.
