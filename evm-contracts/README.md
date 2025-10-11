# EVM Smart Contracts - Cross-Chain Privacy Bridge

A privacy-preserving cross-chain bridge between EVM-compatible chains (using fhEVM for encrypted computation) and Solana, featuring a universal router for privacy pool operations.

## Overview

This system enables private cross-chain token transfers by leveraging Fully Homomorphic Encryption (FHE) on the EVM side and Solana's high-performance blockchain on the destination side.

## Architecture

![System Architecture](./img/diagram-full.png)

The diagram above shows the complete cross-chain bridge flow between EVM (Ethereum) and Solana networks:

### Key Components:
- **User**: Initiates encrypted bridge transfers
- **Solana Wallet**: Receives tokens on Solana side
- **Solana Network**: Target blockchain for cross-chain transfers
- **Arcoum Backend**: Validates transactions and manages bridge state
- **Bridge Service**: Coordinates cross-chain communication
- **Ethereum Network**: Source blockchain with FHE capabilities
- **ZK Verifier**: Validates zero-knowledge proofs for encrypted data
- **Ethereum Wallet**: User's wallet on EVM side

### Privacy Flow:
1. User encrypts transaction data (amounts, destination addresses)
2. Transaction submitted to Ethereum with ZK proofs
3. Bridge service validates and processes encrypted payload
4. Relayer decrypts destination address off-chain
5. Transfer executed on Solana with confirmation back to Ethereum

---

## Core Contracts

### 1. UniversalRouter

**Location:** `contracts/UniversalRouter.sol`

#### Description
A universal router that manages privacy pool operations with support for encrypted swaps and liquidity provision. It acts as the main entry point for users interacting with privacy pools (PrivacyPoolV5).

#### Key Features
- **Pool Registry**: Register and manage V5 privacy pools
- **Private Swaps**: Execute swaps with encrypted amounts using fhEVM
- **Public Swaps**: Standard token swaps with public amounts
- **Liquidity Management**: Add liquidity to privacy pools with tick ranges
- **Safe Token Handling**: Uses OpenZeppelin's SafeERC20 for secure token transfers

#### Main Functions

##### Pool Management
```solidity
function registerPoolV5(address poolAddress) external
```
Register a new V5 privacy pool in the router.

```solidity
function deactivatePool(address token0, address token1) external
```
Deactivate a registered pool.

##### Swap Operations
```solidity
function swapV5Private(
    address token0,
    address token1,
    externalEuint64 encryptedAmountIn,
    externalEuint64 encryptedMinOut,
    bool zeroForOne,
    bytes calldata amountProof,
    bytes calldata minOutProof,
    uint256 deadline
) external returns (uint256 requestId)
```
Execute a private swap with encrypted amounts (asynchronous operation).

```solidity
function swapV5Public(
    address token0,
    address token1,
    uint256 amountIn,
    uint256 amountOutMin,
    bool zeroForOne,
    uint256 deadline
) external returns (uint256 amountOut)
```
Execute a standard public swap.

##### Liquidity Operations
```solidity
function addLiquidityV5(
    address token0,
    address token1,
    int24 tickLower,
    int24 tickUpper,
    uint256 amount0,
    uint256 amount1,
    uint256 deadline
) external returns (uint256 tokenId)
```
Add liquidity to a pool with specified tick range.

#### Events
- `PoolRegistered(address indexed pool, PoolType poolType, address token0, address token1)`
- `PoolDeactivated(address indexed pool)`
- `SwapExecuted(address indexed user, address indexed pool, bool zeroForOne)`
- `LiquidityAdded(address indexed user, address indexed pool, uint256 tokenId)`

---

### 2. Relayer

**Location:** `contracts/Relayer.sol`

#### Description
A cross-chain bridge relayer contract that enables token transfers between EVM and Solana chains. It uses fhEVM's encrypted address functionality to keep destination Solana addresses private during the bridging process.

#### Key Features
- **Encrypted Destination Addresses**: Solana wallet addresses are encrypted using fhEVM
- **Bidirectional Bridge**: Support for EVM → Solana and Solana → EVM transfers
- **Fee Collection**: Configurable fee system with min/max limits
- **Relayer Authorization**: Only authorized relayer can finalize bridge operations
- **Safe Token Handling**: Uses OpenZeppelin's SafeERC20

#### Main Functions

##### Bridge EVM → Solana
```solidity
function initiateBridge(
    address token,
    uint256 amount,
    externalEuint256 encryptedSolanaDestination,
    bytes calldata destinationProof
) external returns (uint256 requestId)
```
Initiate a bridge transfer from EVM to Solana. The Solana destination address is encrypted and only the authorized relayer can decrypt it off-chain.

```solidity
function finalizeBridge(uint256 requestId) external onlyRelayer
```
Finalize a bridge request after the relayer completes the transfer on Solana.

##### Bridge Solana → EVM
```solidity
function deliverTokens(
    address recipient,
    address token,
    uint256 amount
) external onlyRelayer
```
Deliver tokens to an EVM recipient after receiving them from Solana.

##### Admin Functions
```solidity
function updateRelayer(address newRelayer) external onlyOwner
```
Update the authorized relayer address.

```solidity
function updateFeePercentage(uint256 newFeePercentage) external onlyOwner
```
Update the bridge fee percentage (in basis points, max 10%).

```solidity
function updateFeeLimits(uint256 newMinFee, uint256 newMaxFee) external onlyOwner
```
Update minimum and maximum fee amounts.

```solidity
function collectFees(address token, address recipient) external onlyOwner
```
Collect accumulated fees for a specific token.

```solidity
function emergencyWithdraw(address token, uint256 amount, address recipient) external onlyOwner
```
Emergency withdrawal function for contract owner.

#### Fee Structure
- **Default Fee**: 0.3% (30 basis points)
- **Minimum Fee**: 0.001 tokens (1e15)
- **Maximum Fee**: 100 tokens (1e20)
- Fees are capped to prevent excessive charges

#### Events
- `RelayerUpdated(address indexed oldRelayer, address indexed newRelayer)`
- `FeePercentageUpdated(uint256 oldFee, uint256 newFee)`
- `FeesCollected(address indexed token, uint256 amount, address indexed recipient)`
- `BridgeInitiated(uint256 indexed requestId, address indexed sender, address token, uint256 amount)`
- `BridgeFinalized(uint256 indexed requestId, address indexed relayer)`
- `IncomingBridgeDelivered(address indexed recipient, address token, uint256 amount)`

---

## Technology Stack

### Dependencies
- **fhEVM by Zama**: Fully Homomorphic Encryption for EVM
  - `@fhevm/solidity` - FHE operations (euint64, eaddress)
  - Encrypted computation and privacy-preserving operations
- **OpenZeppelin Contracts**: Industry-standard smart contract utilities
  - `SafeERC20` - Safe token transfer operations
  - `ReentrancyGuard` - Protection against reentrancy attacks
  - `Ownable` - Access control
- **Solidity**: ^0.8.24

### Security Features
- Reentrancy protection on all state-changing functions
- Safe token transfers using OpenZeppelin's SafeERC20
- Owner-based access control for admin functions
- Deadline checks for time-sensitive operations
- Fee limits and validation

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Hardhat

### Installation

```bash
npm install
```

### Environment Setup

```bash
# Set your mnemonic
npx hardhat vars set MNEMONIC

# Set Infura API key
npx hardhat vars set INFURA_API_KEY

# Optional: Etherscan API key for verification
npx hardhat vars set ETHERSCAN_API_KEY
```

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
# All tests
npm test

# Specific contract
npx hardhat test test/UniversalRouter.ts
npx hardhat test test/Relayer.ts
```

### Deploy

```bash
# Deploy to local network
npx hardhat node  # In one terminal
npx hardhat deploy --network localhost  # In another

# Deploy to Sepolia testnet
npx hardhat deploy --network sepolia

# Deploy specific contract
npx hardhat deploy --tags Relayer --network sepolia
npx hardhat deploy --tags UniversalRouter --network sepolia
```

---

## Development

### Available Tasks

#### Relayer Tasks
```bash
# Bridge tokens to Solana
npx hardhat relayer:bridge \
  --token 0x... \
  --amount 100 \
  --destination 7EqQdEULxWcraVx3mXKFjc84LhCkMGZCkRuDpvcMwJeK \
  --network sepolia
```

#### Router Tasks
```bash
# Router operations
npx hardhat router --help
```

### Testing

```bash
# Run all tests
npm test

# With coverage
npm run coverage

# With gas reporting
REPORT_GAS=true npm test
```

### Project Structure

```
contracts/
├── Relayer.sol              # Cross-chain bridge
├── UniversalRouter.sol      # Router for pool operations

test/
├── Relayer.ts              # Relayer tests
└── UniversalRouter.ts      # Router tests

tasks/
├── relayer.bridge.ts       # Bridge tasks
├── router.ts               # Router tasks
└── accounts.ts             # Account management

deploy/
├── Relayer.ts              # Deploy Relayer
└── UniversalRouter.ts      # Deploy Router
```

---

## Privacy Features

### Encrypted Computation (fhEVM)
- **Private Swap Amounts**: Users can swap tokens without revealing the exact amounts
- **Private Destination Addresses**: Bridge destination addresses are encrypted on-chain
- **Proof-Based Verification**: All encrypted values require cryptographic proofs

### How It Works
1. User encrypts sensitive data (amounts, addresses) client-side
2. Encrypted data is sent to the smart contract with zero-knowledge proofs
3. Contract performs operations on encrypted data using FHE
4. Only authorized parties (user, contract, relayer) can decrypt results
5. Relayer decrypts off-chain and executes cross-chain transfers

---

## Cross-Chain Bridge Flow

### EVM → Solana
1. User calls `initiateBridge()` with encrypted Solana destination address
2. Contract collects tokens and fees, stores bridge request
3. Relayer monitors events and decrypts destination address off-chain
4. Relayer executes transfer on Solana
5. Relayer calls `finalizeBridge()` to mark request as complete

### Solana → EVM
1. User sends tokens to Solana program
2. Relayer monitors Solana events
3. Relayer calls `deliverTokens()` to send tokens to EVM recipient

---

## Programmatic Usage

```typescript
import { createInstance } from "@fhevm/hardhat-plugin";

// Setup FHE instance
const fhevmInstance = await createInstance({
  chainId: 31337,
  networkUrl: "http://localhost:8545",
  gatewayUrl: "http://localhost:8545",
});

// Encrypt Solana destination
const solanaAddress = "7EqQdEULxWcraVx3mXKFjc84LhCkMGZCkRuDpvcMwJeK";
const encrypted = fhevmInstance.encryptAddress(solanaAddress);

// Approve tokens
await token.approve(relayerAddress, amount);

// Initiate bridge
const tx = await relayer.initiateBridge(
  tokenAddress,
  amount,
  encrypted.handles[0],
  encrypted.inputProof
);
```

---

## Available Commands

### Compilation & Testing

```bash
npm run compile        # Compile contracts
npm run typechain      # Generate TypeScript bindings
npm test              # Run all tests
npm run coverage      # Generate coverage report
npm run lint:sol      # Lint Solidity
npm run lint:ts       # Lint TypeScript
npm run clean         # Clean artifacts
```

### Deployment

```bash
npx hardhat deploy                      # Deploy all
npx hardhat deploy --tags Relayer       # Deploy Relayer only
npx hardhat deploy --tags UniversalRouter # Deploy Router only
npx hardhat deploy --network sepolia    # Deploy to Sepolia
```

---

## Security Considerations

### Auditing Status
These contracts have not been audited. Use at your own risk.

### Known Considerations
1. **Relayer Trust**: The bridge relies on a trusted relayer for cross-chain operations
2. **FHE Limitations**: Encrypted computation has computational overhead
3. **Fee Mechanism**: Ensure fees are properly configured before production use
4. **Emergency Functions**: Owner has emergency withdrawal capabilities

### Best Practices
- Always verify transaction parameters before signing
- Use deadline parameters to prevent stale transactions
- Monitor bridge requests and their finalization status
- Keep private keys secure for encrypted operations

---

## Supported Networks

- **Local:** Hardhat Network (development)
- **Testnet:** Sepolia (testnet deployment)
- **Target Chain:** Solana (via Relayer bridge)

### Deployed Contracts (Sepolia Testnet)

| Contract | Address | Etherscan |
|----------|---------|-----------|
| **UniversalRouter** | `0x023B5D73b322D6103798edDF8a68d30143049c22` | [View on Etherscan](https://sepolia.etherscan.io/address/0x023B5D73b322D6103798edDF8a68d30143049c22#code) |
| **Relayer** | `0x3E9fE2C2032240E0F2428D595e958A77f593697b` | [View on Etherscan](https://sepolia.etherscan.io/address/0x3E9fE2C2032240E0F2428D595e958A77f593697b#code) |

---

## Gas Optimization

- Custom errors instead of revert strings
- Efficient storage patterns
- Batch operations where possible
- Optimized FHE operations

---

## License

BSD-3-Clause

---

## Acknowledgments

- **Zama** for fhEVM technology and FHE infrastructure
- **OpenZeppelin** for security libraries
- **Hardhat** team for development tools
- **Solana** for cross-chain bridge target

---

## Support & Resources

- **FHEVM Docs:** https://docs.zama.ai/fhevm
- **Zama Discord:** https://discord.gg/zama

---

## Use Cases

1. **Privacy Trading:** Trade without revealing swap amounts
2. **Cross-Chain Privacy:** Bridge to Solana with hidden destinations
3. **MEV Protection:** Prevent front-running with encrypted transactions
4. **Private Liquidity:** Provide liquidity without revealing amounts

---

**Built for privacy-preserving DeFi**
