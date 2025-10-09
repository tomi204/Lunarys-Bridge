// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC7984} from "openzeppelin-confidential-contracts/contracts/interfaces/IERC7984.sol";

/// @title RewardsPool - Staking Pool with Encrypted Rewards
/// @notice Stake ERC20 tokens and earn rewards in confidential tokens (CERC20/ERC-7984)
/// @dev APY varies dynamically based on total liquidity: higher liquidity = lower APY, lower liquidity = higher APY
contract RewardsPool is SepoliaConfig, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Configuration ---
    /// @notice Staking token (ERC-20)
    IERC20 public immutable stakingToken;
    /// @notice Rewards token (ERC-7984 - Confidential)
    IERC7984 public immutable rewardsToken;

    /// @notice Base APY in basis points (e.g., 10000 = 100% APY when liquidity is at target)
    uint256 public baseAPY = 10000; // 100% APY base

    /// @notice Target liquidity for optimal APY calculation (18 decimals)
    uint256 public targetLiquidity = 1_000_000 * 1e18;

    /// @notice Minimum APY in basis points (e.g., 500 = 5% minimum APY)
    uint256 public minAPY = 500; // 5% minimum

    // --- State Variables ---
    /// @notice Total staked in the pool
    uint256 public totalStaked;

    /// @notice Rewards per second rate
    uint256 public rewardsPerSecond = 1e15; // 0.001 tokens/sec default

    // --- User Data ---
    struct UserStake {
        uint256 amount; // Amount staked
        uint256 lastUpdateTime; // Last time rewards were calculated
        uint256 accumulatedRewards; // Accumulated rewards not yet claimed
    }

    /// @notice User stake information
    mapping(address => UserStake) public userStakes;

    // --- Events ---
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 rewardsAmount);
    event RewardsRateUpdated(uint256 newRate);
    event APYParametersUpdated(uint256 newBaseAPY, uint256 newTargetLiquidity, uint256 newMinAPY);

    // --- Errors ---
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientStake();
    error InsufficientRewardsInPool();

    /// @notice Contract constructor
    /// @param _stakingToken Address of the staking token (ERC-20)
    /// @param _rewardsToken Address of the rewards token (ERC-7984)
    /// @param initialOwner Address of the initial contract owner
    constructor(address _stakingToken, address _rewardsToken, address initialOwner) Ownable(initialOwner) {
        if (_stakingToken == address(0) || _rewardsToken == address(0)) revert ZeroAddress();
        stakingToken = IERC20(_stakingToken);
        rewardsToken = IERC7984(_rewardsToken);
    }

    // ============================= Core Staking Functions =============================

    /// @notice Stake tokens to earn rewards
    /// @param amount Amount of tokens to stake
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        // Update rewards before changing stake
        _updateRewards(msg.sender);

        // Transfer staking tokens
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Update state
        userStakes[msg.sender].amount += amount;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    /// @notice Unstake tokens
    /// @param amount Amount of tokens to unstake
    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (userStakes[msg.sender].amount < amount) revert InsufficientStake();

        // Update rewards before changing stake
        _updateRewards(msg.sender);

        // Update state
        userStakes[msg.sender].amount -= amount;
        totalStaked -= amount;

        // Transfer staking tokens back
        stakingToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /// @notice Claim accumulated rewards in confidential tokens
    function claimRewards() external nonReentrant {
        // Update rewards first
        _updateRewards(msg.sender);

        uint256 rewardsAmount = userStakes[msg.sender].accumulatedRewards;
        if (rewardsAmount == 0) revert ZeroAmount();

        // Check if rewards amount fits in uint64 (for encryption)
        if (rewardsAmount > type(uint64).max) revert("Rewards too large");

        // Reset accumulated rewards
        userStakes[msg.sender].accumulatedRewards = 0;

        // Create encrypted rewards amount
        euint64 encryptedRewards = FHE.asEuint64(uint64(rewardsAmount));

        // Grant permissions to transfer the encrypted amount
        FHE.allowTransient(encryptedRewards, address(rewardsToken));
        FHE.allow(encryptedRewards, msg.sender);

        // Transfer confidential rewards
        rewardsToken.confidentialTransfer(msg.sender, encryptedRewards);

        emit RewardsClaimed(msg.sender, rewardsAmount);
    }

    /// @notice Emergency unstake all tokens and claim rewards
    function emergencyWithdraw() external nonReentrant {
        UserStake storage userStake = userStakes[msg.sender];
        uint256 amount = userStake.amount;

        if (amount == 0) revert InsufficientStake();

        // Update rewards before withdrawal
        _updateRewards(msg.sender);

        // Claim any accumulated rewards
        uint256 rewardsAmount = userStake.accumulatedRewards;
        if (rewardsAmount > 0 && rewardsAmount <= type(uint64).max) {
            userStake.accumulatedRewards = 0;

            euint64 encryptedRewards = FHE.asEuint64(uint64(rewardsAmount));
            FHE.allowTransient(encryptedRewards, address(rewardsToken));
            FHE.allow(encryptedRewards, msg.sender);

            rewardsToken.confidentialTransfer(msg.sender, encryptedRewards);
            emit RewardsClaimed(msg.sender, rewardsAmount);
        }

        // Reset user stake
        userStake.amount = 0;
        totalStaked -= amount;

        // Transfer staking tokens back
        stakingToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    // ============================= View Functions =============================

    /// @notice Get current APY based on total liquidity
    /// @return Current APY in basis points (10000 = 100%)
    function getCurrentAPY() public view returns (uint256) {
        if (totalStaked == 0) {
            return baseAPY; // Maximum APY when no liquidity
        }

        // Formula: APY = baseAPY / (1 + totalStaked / targetLiquidity)
        // This makes APY decrease as totalStaked increases
        uint256 liquidityRatio = (totalStaked * 1e18) / targetLiquidity;
        uint256 denominator = 1e18 + liquidityRatio;
        uint256 currentAPY = (baseAPY * 1e18) / denominator;

        // Ensure minimum APY
        if (currentAPY < minAPY) {
            return minAPY;
        }

        return currentAPY;
    }

    /// @notice Calculate pending rewards for a user
    /// @param user Address of the user
    /// @return Pending rewards amount
    function pendingRewards(address user) public view returns (uint256) {
        UserStake memory userStake = userStakes[user];
        if (userStake.amount == 0) {
            return userStake.accumulatedRewards;
        }

        uint256 timeElapsed = block.timestamp - userStake.lastUpdateTime;
        uint256 currentAPY = getCurrentAPY();

        // Calculate rewards: (stakedAmount * APY * timeElapsed) / (365 days * 10000)
        // APY is in basis points, so divide by 10000
        uint256 newRewards = (userStake.amount * currentAPY * timeElapsed) / (365 days * 10000);

        return userStake.accumulatedRewards + newRewards;
    }

    /// @notice Get user stake information
    /// @param user Address of the user
    /// @return amount Staked amount
    /// @return lastUpdateTime Last update timestamp
    /// @return accumulatedRewards Accumulated rewards
    function getUserStake(
        address user
    ) external view returns (uint256 amount, uint256 lastUpdateTime, uint256 accumulatedRewards) {
        UserStake memory userStake = userStakes[user];
        return (userStake.amount, userStake.lastUpdateTime, userStake.accumulatedRewards);
    }

    /// @notice Get pool statistics
    /// @return _totalStaked Total staked in pool
    /// @return _currentAPY Current APY
    /// @return _rewardsPerSecond Rewards per second
    function getPoolStats()
        external
        view
        returns (uint256 _totalStaked, uint256 _currentAPY, uint256 _rewardsPerSecond)
    {
        return (totalStaked, getCurrentAPY(), rewardsPerSecond);
    }

    // ============================= Admin Functions =============================

    /// @notice Update rewards rate per second
    /// @param newRate New rewards rate
    function setRewardsPerSecond(uint256 newRate) external onlyOwner {
        rewardsPerSecond = newRate;
        emit RewardsRateUpdated(newRate);
    }

    /// @notice Update APY parameters
    /// @param newBaseAPY New base APY in basis points
    /// @param newTargetLiquidity New target liquidity
    /// @param newMinAPY New minimum APY in basis points
    function setAPYParameters(uint256 newBaseAPY, uint256 newTargetLiquidity, uint256 newMinAPY) external onlyOwner {
        require(newBaseAPY >= newMinAPY, "Base APY must be >= min APY");
        require(newTargetLiquidity > 0, "Target liquidity must be > 0");

        baseAPY = newBaseAPY;
        targetLiquidity = newTargetLiquidity;
        minAPY = newMinAPY;

        emit APYParametersUpdated(newBaseAPY, newTargetLiquidity, newMinAPY);
    }

    /// @notice Fund the pool with rewards tokens (for testing)
    /// @param amount Amount of rewards tokens to add
    function fundRewards(uint256 amount) external onlyOwner {
        if (amount == 0 || amount > type(uint64).max) revert ZeroAmount();

        uint64 amount64 = uint64(amount);
        euint64 encryptedAmount = FHE.asEuint64(amount64);

        FHE.allowTransient(encryptedAmount, address(rewardsToken));
        FHE.allow(encryptedAmount, address(this));

        rewardsToken.confidentialTransferFrom(msg.sender, address(this), encryptedAmount);
    }

    // ============================= Internal Functions =============================

    /// @notice Update rewards for a user
    /// @param user Address of the user
    function _updateRewards(address user) internal {
        UserStake storage userStake = userStakes[user];

        if (userStake.amount > 0) {
            uint256 timeElapsed = block.timestamp - userStake.lastUpdateTime;
            if (timeElapsed > 0) {
                uint256 currentAPY = getCurrentAPY();

                // Calculate rewards: (stakedAmount * APY * timeElapsed) / (365 days * 10000)
                uint256 newRewards = (userStake.amount * currentAPY * timeElapsed) / (365 days * 10000);

                userStake.accumulatedRewards += newRewards;
            }
        }

        userStake.lastUpdateTime = block.timestamp;
    }
}
