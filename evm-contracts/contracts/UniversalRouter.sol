// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPrivacyPoolV5 {
    function initiatePrivateSwap(
        externalEuint64 encryptedAmountIn,
        externalEuint64 encryptedMinOut,
        bool zeroForOne,
        address recipient,
        bytes calldata amountProof,
        bytes calldata minOutProof,
        uint256 deadline
    ) external returns (uint256 requestId);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        bool zeroForOne,
        address recipient,
        uint256 deadline
    ) external returns (uint256 amountOut);

    function addLiquidity(
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 amount1,
        address recipient,
        uint256 deadline
    ) external returns (uint256 tokenId);

    function token0() external view returns (IERC20);

    function token1() external view returns (IERC20);
}

/// @title UniversalRouter - Router for PrivacyPoolV5
/// @notice Routes swaps and liquidity operations for V5 pools
/// @dev Handles approvals and path routing for privacy pools
contract UniversalRouter is SepoliaConfig, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Pool Registry ---
    enum PoolType {
        V5_PUBLIC // Both tokens public, amounts private
    }

    struct PoolInfo {
        address poolAddress;
        PoolType poolType;
        address token0;
        address token1;
        bool active;
    }

    mapping(bytes32 => PoolInfo) public pools; // keccak256(token0, token1) => PoolInfo
    bytes32[] public poolKeys;

    // --- Events ---
    event PoolRegistered(address indexed pool, PoolType poolType, address token0, address token1);
    event PoolDeactivated(address indexed pool);
    event SwapExecuted(address indexed user, address indexed pool, bool zeroForOne);
    event LiquidityAdded(address indexed user, address indexed pool, uint256 tokenId);

    // --- Errors ---
    error PoolNotFound();
    error PoolInactive();
    error InvalidPoolType();
    error InvalidPath();
    error Expired();
    error InsufficientOutput();
    error ZeroAmount();

    // ============================= Pool Registry =============================

    /// @notice Register a pool V5 (public with private amounts)
    function registerPoolV5(address poolAddress) external {
        IPrivacyPoolV5 pool = IPrivacyPoolV5(poolAddress);
        address token0 = address(pool.token0());
        address token1 = address(pool.token1());

        bytes32 key = _getPoolKey(token0, token1);
        pools[key] = PoolInfo({
            poolAddress: poolAddress,
            poolType: PoolType.V5_PUBLIC,
            token0: token0,
            token1: token1,
            active: true
        });
        poolKeys.push(key);

        emit PoolRegistered(poolAddress, PoolType.V5_PUBLIC, token0, token1);
    }

    /// @notice Deactivate a pool
    function deactivatePool(address token0, address token1) external {
        bytes32 key = _getPoolKey(token0, token1);
        PoolInfo storage pool = pools[key];
        if (pool.poolAddress == address(0)) revert PoolNotFound();
        pool.active = false;
        emit PoolDeactivated(pool.poolAddress);
    }

    // ============================= V5 Public Pool Operations =============================

    /// @notice Swap on V5 pool with private amounts - ASYNC
    function swapV5Private(
        address token0,
        address token1,
        externalEuint64 encryptedAmountIn,
        externalEuint64 encryptedMinOut,
        bool zeroForOne,
        bytes calldata amountProof,
        bytes calldata minOutProof,
        uint256 deadline
    ) external nonReentrant returns (uint256 requestId) {
        if (block.timestamp > deadline) revert Expired();

        PoolInfo memory pool = _getPool(token0, token1);
        if (pool.poolType != PoolType.V5_PUBLIC) revert InvalidPoolType();

        IPrivacyPoolV5 poolContract = IPrivacyPoolV5(pool.poolAddress);
        requestId = poolContract.initiatePrivateSwap(
            encryptedAmountIn,
            encryptedMinOut,
            zeroForOne,
            msg.sender,
            amountProof,
            minOutProof,
            deadline
        );

        emit SwapExecuted(msg.sender, pool.poolAddress, zeroForOne);
    }

    /// @notice Swap on V5 pool (standard public swap)
    function swapV5Public(
        address token0,
        address token1,
        uint256 amountIn,
        uint256 amountOutMin,
        bool zeroForOne,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        if (block.timestamp > deadline) revert Expired();
        if (amountIn == 0) revert ZeroAmount();

        PoolInfo memory pool = _getPool(token0, token1);
        if (pool.poolType != PoolType.V5_PUBLIC) revert InvalidPoolType();

        IERC20 inputToken = zeroForOne ? IERC20(token0) : IERC20(token1);
        inputToken.safeTransferFrom(msg.sender, address(this), amountIn);
        inputToken.approve(pool.poolAddress, amountIn);

        IPrivacyPoolV5 poolContract = IPrivacyPoolV5(pool.poolAddress);
        amountOut = poolContract.swapExactTokensForTokens(amountIn, amountOutMin, zeroForOne, msg.sender, deadline);

        emit SwapExecuted(msg.sender, pool.poolAddress, zeroForOne);
    }

    /// @notice Add liquidity to V5 pool
    function addLiquidityV5(
        address token0,
        address token1,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 amount1,
        uint256 deadline
    ) external nonReentrant returns (uint256 tokenId) {
        if (block.timestamp > deadline) revert Expired();
        if (amount0 == 0 && amount1 == 0) revert ZeroAmount();

        PoolInfo memory pool = _getPool(token0, token1);
        if (pool.poolType != PoolType.V5_PUBLIC) revert InvalidPoolType();

        if (amount0 > 0) {
            IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
            IERC20(token0).approve(pool.poolAddress, amount0);
        }
        if (amount1 > 0) {
            IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);
            IERC20(token1).approve(pool.poolAddress, amount1);
        }

        IPrivacyPoolV5 poolContract = IPrivacyPoolV5(pool.poolAddress);
        tokenId = poolContract.addLiquidity(tickLower, tickUpper, amount0, amount1, msg.sender, deadline);

        emit LiquidityAdded(msg.sender, pool.poolAddress, tokenId);
    }

    // ============================= Helper Functions =============================

    function _getPoolKey(address token0, address token1) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(token0, token1));
    }

    function _getPool(address token0, address token1) private view returns (PoolInfo memory) {
        bytes32 key = _getPoolKey(token0, token1);
        PoolInfo memory pool = pools[key];
        if (pool.poolAddress == address(0)) revert PoolNotFound();
        if (!pool.active) revert PoolInactive();
        return pool;
    }

    /// @notice Get all registered pools
    function getAllPools() external view returns (PoolInfo[] memory) {
        PoolInfo[] memory allPools = new PoolInfo[](poolKeys.length);
        for (uint256 i = 0; i < poolKeys.length; i++) {
            allPools[i] = pools[poolKeys[i]];
        }
        return allPools;
    }

    /// @notice Get pool by tokens
    function getPool(address token0, address token1) external view returns (PoolInfo memory) {
        return _getPool(token0, token1);
    }
}
