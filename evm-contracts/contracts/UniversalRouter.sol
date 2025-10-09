// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool, externalEbool, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC7984} from "openzeppelin-confidential-contracts/contracts/interfaces/IERC7984.sol";

interface IPrivacyPoolV3 {
    function swapToken0ForToken1(
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient,
        uint256 deadline
    ) external returns (euint64 amountOut);

    function swapToken1ForToken0ExactOut(
        externalEuint64 encryptedAmountIn,
        uint256 amountOutMin,
        address recipient,
        bytes calldata inputProof,
        uint256 deadline
    ) external returns (uint256 requestId);

    function provideLiquidityToken0(
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        address recipient,
        uint256 deadline
    ) external returns (uint256 tokenId);

    function provideLiquidityToken1(
        int24 tickLower,
        int24 tickUpper,
        externalEuint64 encryptedAmountIn,
        uint256 amount1Clear,
        address recipient,
        bytes calldata inputProof,
        uint256 deadline
    ) external returns (uint256 requestId);

    function token0() external view returns (IERC20);
    function token1() external view returns (IERC7984);
}

interface IPrivacyPoolV4 {
    function initiateConfidentialSwap(
        externalEuint64 encryptedAmountIn,
        externalEuint64 encryptedMinAmountOut,
        externalEbool encryptedZeroForOne,
        externalEaddress encryptedRecipient,
        bytes calldata amountProof,
        bytes calldata minOutProof,
        bytes calldata directionProof,
        bytes calldata recipientProof,
        uint256 deadline
    ) external returns (uint256 requestId);

    function provideLiquidityToken0(
        int24 tickLower,
        int24 tickUpper,
        externalEuint64 encryptedAmount0,
        uint256 amount0Clear,
        address recipient,
        bytes calldata inputProof,
        uint256 deadline
    ) external returns (uint256 requestId);

    function provideLiquidityToken1(
        int24 tickLower,
        int24 tickUpper,
        externalEuint64 encryptedAmountIn,
        uint256 amount1Clear,
        address recipient,
        bytes calldata inputProof,
        uint256 deadline
    ) external returns (uint256 requestId);

    function token0() external view returns (IERC7984);
    function token1() external view returns (IERC7984);
}

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

/// @title UniversalRouter - Multi-pool router for all PrivacyPool versions
/// @notice Routes swaps and liquidity operations across V3, V4, and V5 pools
/// @dev Handles approvals, path routing, and multi-hop swaps
contract UniversalRouter is SepoliaConfig, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Pool Registry ---
    enum PoolType {
        V3_HYBRID,      // Public token0 + Confidential token1
        V4_CONFIDENTIAL, // Both tokens confidential
        V5_PUBLIC       // Both tokens public, amounts private
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

    /// @notice Register a pool V3 (hybrid)
    function registerPoolV3(address poolAddress) external {
        IPrivacyPoolV3 pool = IPrivacyPoolV3(poolAddress);
        address token0 = address(pool.token0());
        address token1 = address(pool.token1());

        bytes32 key = _getPoolKey(token0, token1);
        pools[key] = PoolInfo({
            poolAddress: poolAddress,
            poolType: PoolType.V3_HYBRID,
            token0: token0,
            token1: token1,
            active: true
        });
        poolKeys.push(key);

        emit PoolRegistered(poolAddress, PoolType.V3_HYBRID, token0, token1);
    }

    /// @notice Register a pool V4 (fully confidential)
    function registerPoolV4(address poolAddress) external {
        IPrivacyPoolV4 pool = IPrivacyPoolV4(poolAddress);
        address token0 = address(pool.token0());
        address token1 = address(pool.token1());

        bytes32 key = _getPoolKey(token0, token1);
        pools[key] = PoolInfo({
            poolAddress: poolAddress,
            poolType: PoolType.V4_CONFIDENTIAL,
            token0: token0,
            token1: token1,
            active: true
        });
        poolKeys.push(key);

        emit PoolRegistered(poolAddress, PoolType.V4_CONFIDENTIAL, token0, token1);
    }

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

    // ============================= V3 Hybrid Pool Operations =============================

    /// @notice Swap on V3 pool: token0 (public) -> token1 (confidential)
    function swapV3Token0ForToken1(
        address token0,
        address token1,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 deadline
    ) external nonReentrant returns (euint64 amountOut) {
        if (block.timestamp > deadline) revert Expired();
        if (amountIn == 0) revert ZeroAmount();

        PoolInfo memory pool = _getPool(token0, token1);
        if (pool.poolType != PoolType.V3_HYBRID) revert InvalidPoolType();

        IERC20(token0).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(token0).approve(pool.poolAddress, amountIn);

        IPrivacyPoolV3 poolContract = IPrivacyPoolV3(pool.poolAddress);
        amountOut = poolContract.swapToken0ForToken1(amountIn, amountOutMin, msg.sender, deadline);

        emit SwapExecuted(msg.sender, pool.poolAddress, true);
    }

    /// @notice Swap on V3 pool: token1 (confidential) -> token0 (public) - ASYNC
    function swapV3Token1ForToken0(
        address token0,
        address token1,
        externalEuint64 encryptedAmountIn,
        uint256 amountOutMin,
        bytes calldata inputProof,
        uint256 deadline
    ) external nonReentrant returns (uint256 requestId) {
        if (block.timestamp > deadline) revert Expired();

        PoolInfo memory pool = _getPool(token0, token1);
        if (pool.poolType != PoolType.V3_HYBRID) revert InvalidPoolType();

        IPrivacyPoolV3 poolContract = IPrivacyPoolV3(pool.poolAddress);
        requestId = poolContract.swapToken1ForToken0ExactOut(
            encryptedAmountIn,
            amountOutMin,
            msg.sender,
            inputProof,
            deadline
        );

        emit SwapExecuted(msg.sender, pool.poolAddress, false);
    }

    /// @notice Provide liquidity token0 on V3
    function provideLiquidityV3Token0(
        address token0,
        address token1,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 deadline
    ) external nonReentrant returns (uint256 tokenId) {
        if (block.timestamp > deadline) revert Expired();
        if (amount0 == 0) revert ZeroAmount();

        PoolInfo memory pool = _getPool(token0, token1);
        if (pool.poolType != PoolType.V3_HYBRID) revert InvalidPoolType();

        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token0).approve(pool.poolAddress, amount0);

        IPrivacyPoolV3 poolContract = IPrivacyPoolV3(pool.poolAddress);
        tokenId = poolContract.provideLiquidityToken0(tickLower, tickUpper, amount0, msg.sender, deadline);

        emit LiquidityAdded(msg.sender, pool.poolAddress, tokenId);
    }

    /// @notice Provide liquidity token1 on V3 - ASYNC
    function provideLiquidityV3Token1(
        address token0,
        address token1,
        int24 tickLower,
        int24 tickUpper,
        externalEuint64 encryptedAmount1,
        uint256 amount1Clear,
        bytes calldata inputProof,
        uint256 deadline
    ) external nonReentrant returns (uint256 requestId) {
        if (block.timestamp > deadline) revert Expired();
        if (amount1Clear == 0) revert ZeroAmount();

        PoolInfo memory pool = _getPool(token0, token1);
        if (pool.poolType != PoolType.V3_HYBRID) revert InvalidPoolType();

        IPrivacyPoolV3 poolContract = IPrivacyPoolV3(pool.poolAddress);
        requestId = poolContract.provideLiquidityToken1(
            tickLower,
            tickUpper,
            encryptedAmount1,
            amount1Clear,
            msg.sender,
            inputProof,
            deadline
        );

        emit LiquidityAdded(msg.sender, pool.poolAddress, requestId);
    }

    // ============================= V4 Confidential Pool Operations =============================

    /// @notice Swap on V4 pool (fully confidential) - ASYNC
    function swapV4Confidential(
        address token0,
        address token1,
        externalEuint64 encryptedAmountIn,
        externalEuint64 encryptedMinAmountOut,
        externalEbool encryptedZeroForOne,
        externalEaddress encryptedRecipient,
        bytes calldata amountProof,
        bytes calldata minOutProof,
        bytes calldata directionProof,
        bytes calldata recipientProof,
        uint256 deadline
    ) external nonReentrant returns (uint256 requestId) {
        if (block.timestamp > deadline) revert Expired();

        PoolInfo memory pool = _getPool(token0, token1);
        if (pool.poolType != PoolType.V4_CONFIDENTIAL) revert InvalidPoolType();

        IPrivacyPoolV4 poolContract = IPrivacyPoolV4(pool.poolAddress);
        requestId = poolContract.initiateConfidentialSwap(
            encryptedAmountIn,
            encryptedMinAmountOut,
            encryptedZeroForOne,
            encryptedRecipient,
            amountProof,
            minOutProof,
            directionProof,
            recipientProof,
            deadline
        );

        emit SwapExecuted(msg.sender, pool.poolAddress, true);
    }

    /// @notice Provide liquidity on V4 pool - ASYNC
    function provideLiquidityV4(
        address token0,
        address token1,
        bool isToken0,
        int24 tickLower,
        int24 tickUpper,
        externalEuint64 encryptedAmount,
        uint256 amountClear,
        bytes calldata inputProof,
        uint256 deadline
    ) external nonReentrant returns (uint256 requestId) {
        if (block.timestamp > deadline) revert Expired();
        if (amountClear == 0) revert ZeroAmount();

        PoolInfo memory pool = _getPool(token0, token1);
        if (pool.poolType != PoolType.V4_CONFIDENTIAL) revert InvalidPoolType();

        IPrivacyPoolV4 poolContract = IPrivacyPoolV4(pool.poolAddress);

        if (isToken0) {
            requestId = poolContract.provideLiquidityToken0(
                tickLower,
                tickUpper,
                encryptedAmount,
                amountClear,
                msg.sender,
                inputProof,
                deadline
            );
        } else {
            requestId = poolContract.provideLiquidityToken1(
                tickLower,
                tickUpper,
                encryptedAmount,
                amountClear,
                msg.sender,
                inputProof,
                deadline
            );
        }

        emit LiquidityAdded(msg.sender, pool.poolAddress, requestId);
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
