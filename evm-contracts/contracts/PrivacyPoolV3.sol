// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC7984} from "openzeppelin-confidential-contracts/contracts/interfaces/IERC7984.sol";
import {IPositionNFT} from "./interfaces/IPositionNFT.sol";

/// @title PrivacyPoolV3 - Hybrid AMM (x*y=k) with FIXED reserve tracking
/// @notice Token0 is public ERC20, Token1 is confidential ERC7984
/// @dev FIXES: Async decryption for reserve updates, proper operator validation
contract PrivacyPoolV3 is SepoliaConfig, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Configuration ---
    IERC20 public immutable token0;
    IERC7984 public immutable token1;
    uint24 public immutable fee; // basis points (e.g., 3000 = 0.3%)
    int24 public immutable tickSpacing;
    IPositionNFT public immutable positionNFT;

    // --- AMM State ---
    uint112 private reserve0Last; // Public token0 balance
    uint112 private reserve1VirtualLast; // Virtual reserve for token1 (encrypted)
    uint32 private blockTimestampLast;

    // --- Analytics ---
    uint256 private volumeEpoch;
    uint256 private epochStart;
    uint256 private constant EPOCH = 6 hours;

    // --- Liquidity tracking ---
    mapping(uint256 => uint256) internal positionLiquidity;
    mapping(address => uint256) public userLastClaim;
    uint256 public rewardRatePerSec = 1e15;

    // --- Pending operations for async decryption ---
    struct PendingLiquidity {
        address user;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount1Clear; // Expected amount
        bool isDeposit; // true = deposit, false = withdraw
    }

    struct PendingSwap {
        address recipient;
        uint256 minOut;
        uint112 r0Before;
        uint112 r1Before;
    }

    mapping(uint256 => PendingLiquidity) private _pendingLiq;
    mapping(uint256 => PendingSwap) private _pendingSwap;

    // --- Events ---
    event SwapConfidential(address indexed sender, address indexed recipient, bool zeroForOne);
    event MintConfidential(address indexed sender, address indexed owner, int24 tickLower, int24 tickUpper);
    event BurnConfidential(address indexed owner, int24 tickLower, int24 tickUpper);
    event RewardsClaimed(address indexed user);
    event ReservesUpdated(uint112 reserve0, uint112 reserve1Virtual);

    // --- Errors ---
    error Expired();
    error ZeroAmount();
    error BadRecipient();
    error BadRange();
    error Slippage();
    error EmptyReserves();
    error NoPending(uint256 id);
    error AlreadySeeded();
    error AmountTooSmall();
    error Overflow();
    error NotPositionOwner();
    error InsufficientLiquidity();
    error OperatorNotSet();

    bytes32 public immutable domainSeparator;

    constructor(
        address _token0,
        address _token1,
        uint24 _fee,
        int24 _tickSpacing,
        address _positionNFT,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_token0 == address(0) || _token1 == address(0)) revert ZeroAmount();
        token0 = IERC20(_token0);
        token1 = IERC7984(_token1);
        fee = _fee;
        tickSpacing = _tickSpacing;
        positionNFT = IPositionNFT(_positionNFT);
        epochStart = block.timestamp;
        domainSeparator = keccak256(abi.encode(keccak256("PRIV_POOL_V3_DOMAIN"), address(this), block.chainid));
    }

    // ============================= Initialization =============================

    function seedVirtualReserves(uint112 r1Virtual) external onlyOwner {
        if (reserve0Last != 0 || reserve1VirtualLast != 0) revert AlreadySeeded();
        if (r1Virtual == 0) revert ZeroAmount();

        uint256 r0 = token0.balanceOf(address(this));
        if (r0 == 0) revert EmptyReserves();

        _updateReserves(_cast112(r0), r1Virtual);
    }

    // ============================= Swaps =============================

    /// @notice Swap token0 (public) for token1 (confidential)
    function swapToken0ForToken1(
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (euint64 amountOut) {
        if (block.timestamp > deadline) revert Expired();
        if (amountIn == 0) revert ZeroAmount();
        if (recipient == address(0)) revert BadRecipient();

        token0.safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 r0Before = reserve0Last;
        uint256 r1Before = reserve1VirtualLast;
        if (r0Before == 0 || r1Before == 0) revert EmptyReserves();

        uint256 amountInAfterFee = (amountIn * (1e6 - fee)) / 1e6;
        if (amountInAfterFee == 0) revert AmountTooSmall();

        uint256 k = r0Before * r1Before;
        uint256 r0After = r0Before + amountInAfterFee;
        uint256 r1After = k / r0After;
        uint256 outClear = r1Before - r1After;

        if (outClear < amountOutMin) revert Slippage();
        if (outClear == 0) revert AmountTooSmall();
        if (outClear > type(uint64).max) revert Overflow();

        amountOut = FHE.asEuint64(_cast64(outClear));
        FHE.allowTransient(amountOut, address(token1));
        token1.confidentialTransfer(recipient, amountOut);

        // Update reserves: r0 increases by actual balance, r1 decreases by calculated amount
        uint256 actualR0 = token0.balanceOf(address(this));
        _updateReserves(_cast112(actualR0), _cast112(r1After));
        _bumpEpoch(amountIn);

        emit SwapConfidential(msg.sender, recipient, true);
    }

    /// @notice Initiate swap token1 (confidential) for token0 (public) - ASYNC
    function swapToken1ForToken0ExactOut(
        externalEuint64 encryptedAmountIn,
        uint256 amountOutMin,
        address recipient,
        bytes calldata inputProof,
        uint256 deadline
    ) external nonReentrant returns (uint256 requestId) {
        if (block.timestamp > deadline) revert Expired();
        if (recipient == address(0)) revert BadRecipient();
        if (amountOutMin == 0) revert ZeroAmount();

        uint112 r0Before = _cast112(token0.balanceOf(address(this)));
        uint112 r1Before = reserve1VirtualLast;
        if (r0Before == 0 || r1Before == 0) revert EmptyReserves();

        euint64 amount = FHE.fromExternal(encryptedAmountIn, inputProof);
        FHE.allowTransient(amount, address(token1));
        euint64 amountTransferred = token1.confidentialTransferFrom(msg.sender, address(this), amount);

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(amountTransferred);
        requestId = FHE.requestDecryption(cts, this.finalizeSwapToken1ForToken0.selector);

        _pendingSwap[requestId] = PendingSwap({
            recipient: recipient,
            minOut: amountOutMin,
            r0Before: r0Before,
            r1Before: r1Before
        });

        emit SwapConfidential(msg.sender, recipient, false);
    }

    /// @notice Finalize async swap (token1 -> token0)
    function finalizeSwapToken1ForToken0(
        uint256 requestID,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) public nonReentrant {
        FHE.checkSignatures(requestID, cleartexts, decryptionProof);
        PendingSwap memory p = _pendingSwap[requestID];
        if (p.recipient == address(0)) revert NoPending(requestID);
        delete _pendingSwap[requestID];

        uint64 amountIn = abi.decode(cleartexts, (uint64));
        uint256 inAfterFee = (uint256(amountIn) * (1e6 - fee)) / 1e6;
        if (inAfterFee == 0) revert AmountTooSmall();

        uint256 k = p.r0Before * p.r1Before;
        uint256 r1After = p.r1Before + inAfterFee;
        uint256 r0After = k / r1After;
        uint256 outClear = p.r0Before - r0After;

        if (outClear < p.minOut) revert Slippage();
        if (outClear == 0) revert AmountTooSmall();

        token0.safeTransfer(p.recipient, outClear);
        _updateReserves(_cast112(r0After), _cast112(r1After));
        _bumpEpoch(outClear);
    }

    // ============================= Liquidity (Token0 - Public) =============================

    function provideLiquidityToken0(
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (uint256 tokenId) {
        if (block.timestamp > deadline) revert Expired();
        if (amount0 == 0) revert ZeroAmount();
        if (recipient == address(0)) revert BadRecipient();
        if (tickLower >= tickUpper) revert BadRange();

        token0.safeTransferFrom(msg.sender, address(this), amount0);

        euint64 liquidityHandle = FHE.asEuint64(_cast64(amount0));
        euint64 token0Handle = FHE.asEuint64(_cast64(amount0));
        euint64 zeroHandle = FHE.asEuint64(0);

        _allowHandle(liquidityHandle, address(this));
        _allowHandle(liquidityHandle, address(positionNFT));
        _allowHandle(liquidityHandle, recipient);

        _allowHandle(token0Handle, address(this));
        _allowHandle(token0Handle, address(positionNFT));
        _allowHandle(token0Handle, recipient);

        _allowHandle(zeroHandle, address(this));
        _allowHandle(zeroHandle, address(positionNFT));
        _allowHandle(zeroHandle, recipient);

        tokenId = positionNFT.mint(
            recipient,
            address(token0),
            address(token1),
            tickLower,
            tickUpper,
            liquidityHandle,
            token0Handle,
            zeroHandle,
            false
        );

        positionLiquidity[tokenId] = amount0;

        // Update reserve0 based on actual balance
        uint256 currentBalance = token0.balanceOf(address(this));
        _updateReserves(_cast112(currentBalance), reserve1VirtualLast);

        emit MintConfidential(msg.sender, recipient, tickLower, tickUpper);
    }

    // ============================= Liquidity (Token1 - Confidential) ASYNC =============================

    /// @notice Provide liquidity with token1 (confidential) - ASYNC DECRYPTION
    function provideLiquidityToken1(
        int24 tickLower,
        int24 tickUpper,
        externalEuint64 encryptedAmountIn,
        uint256 amount1Clear,
        address recipient,
        bytes calldata inputProof,
        uint256 deadline
    ) external nonReentrant returns (uint256 requestId) {
        if (block.timestamp > deadline) revert Expired();
        if (recipient == address(0)) revert BadRecipient();
        if (tickLower >= tickUpper) revert BadRange();
        if (amount1Clear == 0) revert ZeroAmount();

        euint64 amount = FHE.fromExternal(encryptedAmountIn, inputProof);
        FHE.allowTransient(amount, address(token1));

        // Transfer and get actual encrypted amount transferred
        euint64 amountTransferred = token1.confidentialTransferFrom(msg.sender, address(this), amount);

        // Request decryption to know the REAL amount
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(amountTransferred);
        requestId = FHE.requestDecryption(cts, this.finalizeProvideLiquidityToken1.selector);

        _pendingLiq[requestId] = PendingLiquidity({
            user: recipient,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount1Clear: amount1Clear,
            isDeposit: true
        });
    }

    /// @notice Finalize liquidity provision for token1
    function finalizeProvideLiquidityToken1(
        uint256 requestID,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) public nonReentrant {
        FHE.checkSignatures(requestID, cleartexts, decryptionProof);
        PendingLiquidity memory p = _pendingLiq[requestID];
        if (p.user == address(0)) revert NoPending(requestID);
        delete _pendingLiq[requestID];

        uint64 actualAmount = abi.decode(cleartexts, (uint64));
        if (actualAmount == 0) revert ZeroAmount();

        // Mint NFT with the ACTUAL amount
        euint64 liquidityHandle = FHE.asEuint64(actualAmount);
        euint64 amountHandle = FHE.asEuint64(actualAmount);
        euint64 zeroHandle = FHE.asEuint64(0);

        _allowHandle(liquidityHandle, address(this));
        _allowHandle(liquidityHandle, address(positionNFT));
        _allowHandle(liquidityHandle, p.user);

        _allowHandle(amountHandle, address(this));
        _allowHandle(amountHandle, address(positionNFT));
        _allowHandle(amountHandle, p.user);

        _allowHandle(zeroHandle, address(this));
        _allowHandle(zeroHandle, address(positionNFT));
        _allowHandle(zeroHandle, p.user);

        uint256 tokenId = positionNFT.mint(
            p.user,
            address(token0),
            address(token1),
            p.tickLower,
            p.tickUpper,
            liquidityHandle,
            zeroHandle,
            amountHandle,
            true
        );

        positionLiquidity[tokenId] = uint256(actualAmount);

        // Update reserve1 with ACTUAL amount
        uint112 newReserve1 = _cast112(uint256(reserve1VirtualLast) + uint256(actualAmount));
        _updateReserves(reserve0Last, newReserve1);

        emit MintConfidential(msg.sender, p.user, p.tickLower, p.tickUpper);
    }

    // ============================= Burn Position =============================

    function burnPosition(uint256 tokenId, uint256 deadline) external nonReentrant {
        if (block.timestamp > deadline) revert Expired();

        address ownerAddr = positionNFT.ownerOf(tokenId);
        if (ownerAddr != msg.sender) revert NotPositionOwner();

        uint256 share = positionLiquidity[tokenId];
        if (share == 0) revert AmountTooSmall();

        IPositionNFT.Position memory position = positionNFT.getPosition(tokenId);
        delete positionLiquidity[tokenId];

        if (position.isConfidential) {
            if (share > reserve1VirtualLast) revert InsufficientLiquidity();

            _allowHandle(position.token1Amount, address(this));
            _allowHandle(position.token1Amount, ownerAddr);
            _allowHandle(position.token1Amount, address(token1));

            token1.confidentialTransfer(ownerAddr, position.token1Amount);

            uint112 newReserve1 = _cast112(uint256(reserve1VirtualLast) - share);
            _updateReserves(reserve0Last, newReserve1);
        } else {
            if (share > reserve0Last) revert InsufficientLiquidity();

            token0.safeTransfer(ownerAddr, share);
            uint112 newReserve0 = _cast112(uint256(reserve0Last) - share);
            _updateReserves(newReserve0, reserve1VirtualLast);
        }

        positionNFT.burn(tokenId);
        emit BurnConfidential(ownerAddr, position.tickLower, position.tickUpper);
    }

    // ============================= Rewards =============================

    function claimRewards() external nonReentrant returns (uint256 rewards) {
        uint256 last = userLastClaim[msg.sender];
        if (last == 0) last = block.timestamp - 3600;
        uint256 dt = block.timestamp - last;
        userLastClaim[msg.sender] = block.timestamp;

        uint256 n = positionNFT.balanceOf(msg.sender);
        uint256 userShare;
        for (uint256 i = 0; i < n; i++) {
            uint256 id = positionNFT.tokenOfOwnerByIndex(msg.sender, i);
            userShare += positionLiquidity[id];
        }

        rewards = (dt * rewardRatePerSec * userShare) / 1e18;
        uint256 poolBal = token0.balanceOf(address(this));
        if (poolBal == 0) {
            emit RewardsClaimed(msg.sender);
            return 0;
        }

        uint256 cap = poolBal / 1000;
        if (cap == 0) cap = poolBal;
        if (rewards > cap) rewards = cap;

        if (rewards > 0) token0.safeTransfer(msg.sender, rewards);
        emit RewardsClaimed(msg.sender);
    }

    // ============================= View Functions =============================

    function getDomainSeparator() external view returns (bytes32) {
        return domainSeparator;
    }

    function getReserves() external view returns (uint112 r0, uint112 r1Virtual, uint32 lastUpdated) {
        return (reserve0Last, reserve1VirtualLast, blockTimestampLast);
    }

    function getEpochData() external view returns (uint256 volume, uint256 startTimestamp) {
        return (volumeEpoch, epochStart);
    }

    // ============================= Internal Functions =============================

    function _updateReserves(uint112 r0, uint112 r1v) internal {
        reserve0Last = r0;
        reserve1VirtualLast = r1v;
        blockTimestampLast = uint32(block.timestamp);
        emit ReservesUpdated(r0, r1v);
    }

    function _allowHandle(euint64 handle, address account) private {
        FHE.allow(handle, account);
    }

    function _cast112(uint256 value) private pure returns (uint112) {
        if (value > type(uint112).max) revert Overflow();
        return uint112(value);
    }

    function _cast64(uint256 value) private pure returns (uint64) {
        if (value > type(uint64).max) revert Overflow();
        return uint64(value);
    }

    function _bumpEpoch(uint256 amountToken0) internal {
        if (block.timestamp - epochStart >= EPOCH) {
            volumeEpoch = amountToken0;
            epochStart = block.timestamp;
        } else {
            volumeEpoch += amountToken0;
        }
    }
}
