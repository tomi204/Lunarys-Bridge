---
sidebar_label: "Bridge EVM Functions"
---

# Bridge EVM Contract

The LUNARYS Bridge EVM contract implements a competitive fast-bridge mechanism between Ethereum and Solana, powered by Zama's FHE (Fully Homomorphic Encryption) technology for privacy-preserving cross-chain transfers.

## Overview

The NewRelayer contract enables:

- **Competitive Solver Model**: Authorized nodes compete to fulfill bridge requests by posting bonds
- **Encrypted Destinations**: Uses FHE to keep recipient addresses private
- **Dynamic Fee System**: Configurable fees with minimum and maximum limits
- **Slashing Protection**: Penalizes solvers who fail to fulfill within the claim window
- **Bidirectional Bridge**: Supports both EVM → Solana and Solana → EVM transfers

## Contract Address

See the [Deployed Addresses](./addresses.md) page for the current deployment.

## Core Functions

### Bridge Initiation (EVM → Solana)

#### `initiateBridge`

Initiates a bridge request from Ethereum to Solana with an encrypted destination address.

```solidity
function initiateBridge(
    address token,
    uint256 amount,
    externalEaddress encryptedSolanaDestination,
    bytes calldata destinationProof
) external nonReentrant returns (uint256 requestId)
```

**Parameters:**
- `token`: ERC-20 token address to bridge
- `amount`: Amount to transfer (including fee)
- `encryptedSolanaDestination`: FHE-encrypted Solana recipient address
- `destinationProof`: Zero-knowledge proof for the encrypted destination

**Returns:** Unique `requestId` for tracking the bridge request

**Access:** Public (any user)

**Events Emitted:**
- `BridgeInitiated(requestId, sender, token, amountAfterFee)`

---

### Competitive Claiming System

#### `claimBridge`

Allows authorized solver nodes to claim a bridge request by posting a bond.

```solidity
function claimBridge(uint256 requestId) external payable nonReentrant onlyAuthorizedNode
```

**Parameters:**
- `requestId`: ID of the bridge request to claim

**Requirements:**
- Caller must be an authorized node
- Must send ETH >= `minSolverBond`
- Request must not be finalized
- No active unexpired claim exists

**Bond Behavior:**
- Solver posts ETH bond when claiming
- Bond is refunded upon successful fulfillment
- Bond is partially slashed if claim expires unfulfilled

**Events Emitted:**
- `BridgeClaimed(requestId, solver, bond, deadline)`
- `BridgeClaimExpired(requestId, oldSolver, slashedAmount)` (if replacing expired claim)

---

#### `releaseExpiredClaim`

Releases an expired claim and slashes the solver's bond without claiming it.

```solidity
function releaseExpiredClaim(uint256 requestId) external nonReentrant
```

**Parameters:**
- `requestId`: ID of the bridge request with an expired claim

**Access:** Public (anyone can trigger)

**Events Emitted:**
- `BridgeClaimExpired(requestId, solver, slashedAmount)`

---

### Verification & Settlement

#### `verifyAndSettle`

Verifies off-chain proof and settles payment to the solver (relayer only).

```solidity
// Simple version
function verifyAndSettle(
    uint256 requestId,
    bytes32 destTxHash,
    bytes32 evidenceHash
) external onlyRelayer nonReentrant

// Extended version with evidence URL
function verifyAndSettle(
    uint256 requestId,
    bytes32 destTxHash,
    bytes32 evidenceHash,
    string calldata evidenceURL
) external onlyRelayer nonReentrant
```

**Parameters:**
- `requestId`: ID of the bridge request
- `destTxHash`: Transaction hash on destination chain (Solana)
- `evidenceHash`: Hash of the fulfillment evidence
- `evidenceURL`: (Optional) URL to off-chain evidence

**Payout Behavior:**
- Transfers `amount + fee` to the solver
- Refunds the solver's bond
- Finalizes the request

**Access:** Relayer only

**Events Emitted:**
- `BridgeVerified(requestId, relayer, destTxHash, evidenceHash)` or
- `BridgeVerifiedURL(requestId, relayer, destTxHash, evidenceHash, evidenceURL)`
- `BridgePaidToSolver(requestId, solver, token, payoutAmount)`
- `SolverBondRefunded(requestId, solver, refundedBond)`

---

### Reverse Bridge (Solana → EVM)

#### `deliverTokens`

Delivers tokens to a recipient on EVM after verification from Solana (relayer only).

```solidity
function deliverTokens(
    address recipient,
    address token,
    uint256 amount
) external onlyRelayer nonReentrant
```

**Parameters:**
- `recipient`: Ethereum address to receive tokens
- `token`: ERC-20 token address
- `amount`: Amount to transfer

**Access:** Relayer only

**Events Emitted:**
- `IncomingBridgeDelivered(recipient, token, amount)`

---

## Configuration Functions (Owner Only)

### Fee Management

#### `updateFeePercentage`

```solidity
function updateFeePercentage(uint256 newFeePercentage) external onlyOwner
```

Updates the fee percentage (in basis points, max 10% = 1000 bps).

**Default:** 30 bps (0.3%)

---

#### `updateFeeLimits`

```solidity
function updateFeeLimits(uint256 newMinFee, uint256 newMaxFee) external onlyOwner
```

Sets minimum and maximum fee amounts.

**Defaults:**
- `minFee`: 1e15 (0.001 tokens)
- `maxFee`: 1e20 (100 tokens)

---

### Solver Management

#### `authorizeNode`

```solidity
function authorizeNode(address node) external onlyOwner
```

Authorizes a solver node to claim bridge requests.

**Events Emitted:** `NodeAuthorized(node)`

---

#### `revokeNode`

```solidity
function revokeNode(address node) external onlyOwner
```

Revokes authorization from a solver node.

**Events Emitted:** `NodeRevoked(node)`

---

#### `updateMinSolverBond`

```solidity
function updateMinSolverBond(uint256 newMinBond) external onlyOwner
```

Updates the minimum bond required for solvers to claim requests.

**Default:** 0.02 ETH

---

### Slashing Configuration

#### `updateSlashParams`

```solidity
function updateSlashParams(uint256 newSlashBps, address newCollector) external onlyOwner
```

Configures slashing percentage and slash recipient address.

**Defaults:**
- `slashBps`: 5000 (50%)
- `slashCollector`: Contract owner

---

### Claim Window

#### `updateClaimWindow`

```solidity
function updateClaimWindow(uint256 newWindow) external onlyOwner
```

Sets the time window for solvers to fulfill a claimed request.

**Default:** 20 minutes
**Range:** 1 minute - 24 hours

---

### Relayer Management

#### `updateRelayer`

```solidity
function updateRelayer(address newRelayer) external onlyOwner
```

Updates the authorized relayer address.

**Events Emitted:** `RelayerUpdated(oldRelayer, newRelayer)`

---

## View Functions

### `getBridgeRequest`

```solidity
function getBridgeRequest(uint256 requestId) external view returns (BridgeRequest memory)
```

Returns detailed information about a bridge request.

**Returns:**
```solidity
struct BridgeRequest {
    address sender;
    address token;
    uint256 amount;
    eaddress encryptedSolanaDestination;
    uint256 timestamp;
    bool finalized;
    uint256 fee;
}
```

---

### `getAuthorizedNodes`

```solidity
function getAuthorizedNodes() external view returns (address[] memory)
```

Returns the list of all currently authorized solver nodes.

---

### `getAuthorizedNodesCount`

```solidity
function getAuthorizedNodesCount() external view returns (uint256)
```

Returns the total number of authorized nodes.

---

### `getContractBalance`

```solidity
function getContractBalance(address token) external view returns (uint256)
```

Returns the contract's balance for a specific token.

---

## Data Structures

### BridgeRequest

```solidity
struct BridgeRequest {
    address sender;              // Original requester
    address token;               // Token being bridged
    uint256 amount;              // Amount after fee deduction
    eaddress encryptedSolanaDestination;  // FHE-encrypted destination
    uint256 timestamp;           // Request creation time
    bool finalized;              // Whether request is complete
    uint256 fee;                 // Fee for this request
}
```

### Claim

```solidity
struct Claim {
    address solver;      // Solver who claimed
    uint64 claimedAt;    // Claim timestamp
    uint64 deadline;     // Fulfillment deadline
    uint256 bond;        // ETH bond amount
}
```

---

## Events Reference

| Event | Description |
|-------|-------------|
| `BridgeInitiated` | User initiates a bridge request |
| `BridgeClaimed` | Solver claims a request with bond |
| `BridgeClaimExpired` | Claim expired and bond slashed |
| `BridgeVerified` | Relayer verified and settled request |
| `BridgeVerifiedURL` | Verified with evidence URL |
| `BridgePaidToSolver` | Solver received payout |
| `SolverBondRefunded` | Solver bond refunded |
| `IncomingBridgeDelivered` | Tokens delivered from Solana |
| `NodeAuthorized` | Solver node authorized |
| `NodeRevoked` | Solver node revoked |
| `RelayerUpdated` | Relayer address changed |
| `FeePercentageUpdated` | Fee percentage changed |
| `FeeLimitsUpdated` | Min/max fee limits changed |
| `FeesCollected` | Legacy fees collected |

---

## Security Features

### Access Control

- **Owner**: Can configure parameters and authorize nodes
- **Relayer**: Can verify and settle bridge requests
- **Authorized Nodes**: Can claim bridge requests
- **Users**: Can initiate bridge requests

### Protection Mechanisms

1. **ReentrancyGuard**: Prevents reentrancy attacks on critical functions
2. **Bond Slashing**: Penalizes solvers who fail to fulfill (50% default)
3. **Claim Window**: Time-bounded fulfillment requirement (20 min default)
4. **Fee Limits**: Min/max bounds prevent excessive fees
5. **FHE Privacy**: Recipient addresses remain encrypted throughout

### Emergency Functions

#### `emergencyWithdraw`

```solidity
function emergencyWithdraw(
    address token,
    uint256 amount,
    address recipient
) external onlyOwner nonReentrant
```

Allows owner to withdraw tokens in emergency situations.

---

## Integration Example

### Initiating a Bridge Transfer

```typescript
import { FhevmInstance } from 'fhevmjs';

// 1. Encrypt Solana destination address
const fhevmInstance = await FhevmInstance.create();
const encryptedDestination = await fhevmInstance.encrypt_address(solanaAddress);

// 2. Approve tokens
await tokenContract.approve(bridgeAddress, amount);

// 3. Initiate bridge
const tx = await bridgeContract.initiateBridge(
    tokenAddress,
    amount,
    encryptedDestination.handles[0],
    encryptedDestination.inputProof
);

const receipt = await tx.wait();
const requestId = receipt.events[0].args.requestId;
```

### Solver: Claiming a Request

```typescript
// Must be an authorized node
const tx = await bridgeContract.claimBridge(requestId, {
    value: ethers.utils.parseEther("0.02") // Minimum bond
});

await tx.wait();
```

---

## Error Reference

| Error | Description |
|-------|-------------|
| `OnlyRelayer` | Caller is not the authorized relayer |
| `NotAuthorizedNode` | Caller is not an authorized solver node |
| `ZeroAddress` | Zero address provided where not allowed |
| `ZeroAmount` | Zero amount provided |
| `InvalidFee` | Fee configuration is invalid |
| `RequestAlreadyFinalized` | Request already completed |
| `RequestNotFound` | Request ID does not exist |
| `ActiveClaim` | Request has an active unexpired claim |
| `NotSolver` | Caller is not the claim's solver |
| `ClaimExpired` | Claim deadline has passed |
| `NoClaim` | No claim exists for this request |
| `BondTooLow` | Provided bond is below minimum |

---

## Technical Implementation

### FHE Integration (Zama)

The contract uses Zama's FHE library for privacy-preserving destination addresses:

```solidity
import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
```

**Key Features:**
- **Encrypted Storage**: Solana addresses stored as FHE ciphertexts
- **Selective Decryption**: Only relayer and solver can decrypt destinations
- **Zero-Knowledge Proofs**: Destinations verified without revealing plaintext

### Permission Model

FHE permissions are granted to:
1. **User** (sender)
2. **Contract** (self)
3. **Relayer** (for verification)
4. **Current Solver** (for fulfillment)

---

## See Also

- [Smart Contracts Overview](./smart-contracts.md)
- [Contract Addresses](./addresses.md)
- [Architecture](./architecture.md)
- [Privacy Protocol](./privacy-protocol.md)
