# RewardsPool - Dynamic APY Staking with Encrypted Rewards

## 📝 Overview

RewardsPool is a sophisticated staking contract that allows users to stake standard ERC20 tokens and earn rewards in
**encrypted tokens (CERC20/ERC-7984)**. The pool features a **dynamic APY system** that adjusts based on total
liquidity, following standard DeFi economics: higher liquidity = lower APY, lower liquidity = higher APY.

## 🌟 Key Features

### 1. **Dynamic APY Calculation**

The APY automatically adjusts based on the pool's total staked amount:

- **Formula**: `APY = baseAPY / (1 + totalStaked / targetLiquidity)`
- When **no liquidity**: APY is at maximum (baseAPY)
- As **liquidity increases**: APY decreases proportionally
- **Minimum floor**: APY never goes below `minAPY` (default 5%)

**Example APY Curve** (with baseAPY=100%, targetLiquidity=1M tokens):

- 0 tokens staked → 100% APY
- 100k tokens staked (10% of target) → ~90.9% APY
- 500k tokens staked (50% of target) → ~66.7% APY
- 1M tokens staked (100% of target) → 50% APY
- 10M tokens staked → 5% APY (hits minimum floor)

### 2. **Privacy-Preserving Rewards**

- Rewards are paid in **encrypted tokens (ERC-7984)**
- Uses **fhEVM (Fully Homomorphic Encryption)** from Zama
- Reward amounts remain confidential on-chain
- Only the recipient can decrypt their balance

### 3. **Flexible Staking**

- Stake any amount of ERC20 tokens
- Unstake anytime (no lock period)
- Claim rewards independently
- Emergency withdraw function

### 4. **Real-Time Rewards Calculation**

- Rewards accrue every second
- Based on:
  - Staked amount
  - Current APY (dynamic)
  - Time elapsed
- Formula: `rewards = (stakedAmount × APY × timeElapsed) / (365 days × 10000)`

## 🏗️ Architecture

### Contract Structure

```solidity
contract RewardsPool is SepoliaConfig, Ownable, ReentrancyGuard {
  // Configuration
  IERC20 public immutable stakingToken; // Standard ERC20
  IERC7984 public immutable rewardsToken; // Encrypted ERC-7984

  // APY Parameters
  uint256 public baseAPY; // e.g., 10000 = 100%
  uint256 public minAPY; // e.g., 500 = 5%
  uint256 public targetLiquidity; // e.g., 1_000_000 * 1e18

  // User Data
  struct UserStake {
    uint256 amount;
    uint256 lastUpdateTime;
    uint256 accumulatedRewards;
  }
}
```

## 📊 How It Works

### Staking Flow

1. User approves staking tokens
2. User calls `stake(amount)`
3. Tokens transferred to pool
4. User's stake is recorded
5. Rewards start accumulating

### Rewards Accumulation

```
Every second:
  currentAPY = baseAPY / (1 + totalStaked / targetLiquidity)
  newRewards = (userStake × currentAPY × timeElapsed) / (365 days × 10000)
  accumulatedRewards += newRewards
```

### Claiming Flow

1. User calls `claimRewards()`
2. Contract calculates total pending rewards
3. Rewards converted to encrypted euint64
4. Confidential transfer to user
5. User receives encrypted tokens (CERC20)

## 🚀 Usage

### Deploy

```bash
npx hardhat deploy --tags RewardsPool
```

### Interact via Tasks

#### Get Pool Info

```bash
npx hardhat rewardspool:info
```

#### Stake Tokens

```bash
npx hardhat rewardspool:stake --amount 1000
```

#### Unstake Tokens

```bash
npx hardhat rewardspool:unstake --amount 500
```

#### Claim Rewards

```bash
npx hardhat rewardspool:claim
```

### Programmatic Usage

```typescript
import { ethers } from "hardhat";

// Get contracts
const rewardsPool = await ethers.getContractAt("RewardsPool", poolAddress);
const stakingToken = await ethers.getContractAt("IERC20", stakingTokenAddress);

// Approve and stake
await stakingToken.approve(poolAddress, amount);
await rewardsPool.stake(amount);

// Check pending rewards
const pending = await rewardsPool.pendingRewards(userAddress);

// Claim rewards (encrypted)
await rewardsPool.claimRewards();

// Unstake
await rewardsPool.unstake(amount);
```

## 🔧 Admin Functions

### Set APY Parameters

```solidity
function setAPYParameters(
    uint256 newBaseAPY,      // e.g., 20000 = 200%
    uint256 newTargetLiquidity, // e.g., 2_000_000 * 1e18
    uint256 newMinAPY        // e.g., 1000 = 10%
) external onlyOwner
```

### Set Rewards Rate

```solidity
function setRewardsPerSecond(uint256 newRate) external onlyOwner
```

## 📈 Example Scenarios

### Scenario 1: Early Adopter

- **Pool State**: 0 tokens staked
- **User Stakes**: 100k tokens
- **APY**: ~90.9% (high because low liquidity)
- **Daily Rewards**: ~249 tokens
- **Yearly Rewards**: ~90,900 tokens

### Scenario 2: Growing Pool

- **Pool State**: 500k tokens staked
- **User Stakes**: 100k tokens (now 600k total)
- **APY**: ~62.5% (moderate)
- **Daily Rewards**: ~171 tokens
- **Yearly Rewards**: ~62,500 tokens

### Scenario 3: Mature Pool

- **Pool State**: 5M tokens staked
- **User Stakes**: 100k tokens (now 5.1M total)
- **APY**: ~16.4% (approaching minimum)
- **Daily Rewards**: ~45 tokens
- **Yearly Rewards**: ~16,400 tokens

## 🔒 Security Features

1. **ReentrancyGuard**: Prevents reentrancy attacks
2. **SafeERC20**: Safe token transfers
3. **Ownable**: Admin functions protected
4. **Overflow Protection**: Safe math operations
5. **Input Validation**: Zero checks, range checks

## 🧪 Testing

Run comprehensive tests:

```bash
npx hardhat test test/RewardsPool.ts
```

Test coverage includes:

- ✅ Deployment and initialization
- ✅ Staking and unstaking
- ✅ Dynamic APY calculations
- ✅ Rewards accumulation over time
- ✅ Encrypted rewards claiming
- ✅ Multiple users scenarios
- ✅ Emergency withdrawals
- ✅ Admin functions
- ✅ Edge cases and errors

## 📚 Technical Details

### Dependencies

- **OpenZeppelin Contracts**: Access control, reentrancy protection, safe ERC20
- **fhEVM (Zama)**: Fully homomorphic encryption for confidential tokens
- **ERC-7984**: Confidential token standard

### Gas Optimization

- Immutable variables for frequently accessed data
- Efficient storage patterns
- Minimal on-chain computations

### Precision

- APY in basis points (10000 = 100%)
- Time-based calculations use seconds
- 18 decimal token support

## 🎯 Use Cases

1. **DeFi Protocols**: Incentivize liquidity provision
2. **DAOs**: Reward token holders with privacy
3. **Yield Farming**: Dynamic APY based on pool size
4. **Private Rewards**: Keep earnings confidential
5. **Staking-as-a-Service**: Customizable parameters

## 🛣️ Roadmap

- [ ] Multi-token staking support
- [ ] Time-locked staking tiers
- [ ] Boost multipliers for long-term stakers
- [ ] Governance integration
- [ ] Auto-compounding rewards
- [ ] Cross-chain bridge support

## 📄 License

BSD-3-Clause

## 🤝 Contributing

Contributions are welcome! Please ensure:

1. All tests pass
2. Code follows Solidity style guide
3. Add tests for new features
4. Update documentation

## ⚠️ Disclaimer

This is experimental software. Use at your own risk. Always audit smart contracts before mainnet deployment.

---

**Built with ❤️ using fhEVM and OpenZeppelin**
