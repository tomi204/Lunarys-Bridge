// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPositionNFT} from "./interfaces/IPositionNFT.sol";

/// @title PrivacyPoolV5 - Public Pool with Private Swap Amounts
/// @notice Like Uniswap V2 but swap amounts are encrypted (privacy-preserving trading)
/// @dev BOTH tokens are public ERC20, but swap amounts are confidential during execution
contract PrivacyPoolV5 is SepoliaConfig, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Configuration ---
    IERC20 public immutable token0;
    IERC20 public immutable token1;
    uint24 public immutable fee; // basis points (e.g., 3000 = 0.3%)
    int24 public immutable tickSpacing;
    IPositionNFT public immutable positionNFT;

    // --- AMM State (PUBLIC reserves) ---
    uint112 private reserve0Last;
    uint112 private reserve1Last;
    uint32 private blockTimestampLast;

    // --- Analytics ---
    uint256 private volumeEpoch;
    uint256 private epochStart;
    uint256 private constant EPOCH = 6 hours;

    // --- Liquidity tracking ---
    mapping(uint256 => uint256) internal positionLiquidityToken0;
    mapping(uint256 => uint256) internal positionLiquidityToken1;
    mapping(address => uint256) public userLastClaim;
    uint256 public rewardRatePerSec = 1e15;

    // --- Pending swaps for privacy (amounts are encrypted during mempool) ---
    struct PendingSwap {
        address initiator;
        address recipient;
        bool zeroForOne;
        uint112 r0Before;
        uint112 r1Before;
    }

    mapping(uint256 => PendingSwap) private _pendingSwap;

    // --- Events (amounts NOT revealed for privacy) ---
    event SwapPrivate(address indexed sender, address indexed recipient, bool zeroForOne);
    event MintLiquidity(address indexed sender, address indexed owner, int24 tickLower, int24 tickUpper);
    event BurnLiquidity(address indexed owner, int24 tickLower, int24 tickUpper);
    event RewardsClaimed(address indexed user);
    event ReservesUpdated(uint112 reserve0, uint112 reserve1);

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
        token1 = IERC20(_token1);
        fee = _fee;
        tickSpacing = _tickSpacing;
        positionNFT = IPositionNFT(_positionNFT);
        epochStart = block.timestamp;
        domainSeparator = keccak256(abi.encode(keccak256("PRIV_POOL_V5_DOMAIN"), address(this), block.chainid));
    }

    // ============================= Initialization =============================

    /// @notice Seed initial reserves (requires tokens already deposited)
    function seedReserves() external onlyOwner {
        if (reserve0Last != 0 || reserve1Last != 0) revert AlreadySeeded();

        uint256 r0 = token0.balanceOf(address(this));
        uint256 r1 = token1.balanceOf(address(this));
        if (r0 == 0 || r1 == 0) revert EmptyReserves();

        _updateReserves(_cast112(r0), _cast112(r1));
    }

    // ============================= Swaps (Private Amounts via Encryption) =============================

    /// @notice Initiate private swap (amount encrypted during mempool)
    /// @dev User encrypts the amount to prevent front-running
    function initiatePrivateSwap(
        externalEuint64 encryptedAmountIn,
        externalEuint64 encryptedMinOut,
        bool zeroForOne,
        address recipient,
        bytes calldata amountProof,
        bytes calldata minOutProof,
        uint256 deadline
    ) external nonReentrant returns (uint256 requestId) {
        if (block.timestamp > deadline) revert Expired();
        if (recipient == address(0)) revert BadRecipient();

        uint112 r0Before = reserve0Last;
        uint112 r1Before = reserve1Last;
        if (r0Before == 0 || r1Before == 0) revert EmptyReserves();

        // Decrypt amount to execute swap
        euint64 amountHandle = FHE.fromExternal(encryptedAmountIn, amountProof);
        euint64 minOutHandle = FHE.fromExternal(encryptedMinOut, minOutProof);

        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(amountHandle);
        cts[1] = FHE.toBytes32(minOutHandle);
        requestId = FHE.requestDecryption(cts, this.finalizePrivateSwap.selector);

        _pendingSwap[requestId] = PendingSwap({
            initiator: msg.sender,
            recipient: recipient,
            zeroForOne: zeroForOne,
            r0Before: r0Before,
            r1Before: r1Before
        });

        emit SwapPrivate(msg.sender, recipient, zeroForOne);
    }

    /// @notice Finalize private swap after decryption
    function finalizePrivateSwap(
        uint256 requestID,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) public nonReentrant {
        FHE.checkSignatures(requestID, cleartexts, decryptionProof);
        PendingSwap memory p = _pendingSwap[requestID];
        if (p.initiator == address(0)) revert NoPending(requestID);
        delete _pendingSwap[requestID];

        (uint64 amountIn, uint64 minOut) = abi.decode(cleartexts, (uint64, uint64));
        if (amountIn == 0) revert ZeroAmount();

        // Transfer input token
        IERC20 inputToken = p.zeroForOne ? token0 : token1;
        inputToken.safeTransferFrom(p.initiator, address(this), amountIn);

        uint256 r0Before = p.r0Before;
        uint256 r1Before = p.r1Before;

        uint256 amountInAfterFee = (uint256(amountIn) * (1e6 - fee)) / 1e6;
        if (amountInAfterFee == 0) revert AmountTooSmall();

        uint256 k = r0Before * r1Before;
        uint256 r0After;
        uint256 r1After;
        uint256 outClear;

        if (p.zeroForOne) {
            r0After = r0Before + amountInAfterFee;
            r1After = k / r0After;
            outClear = r1Before - r1After;
        } else {
            r1After = r1Before + amountInAfterFee;
            r0After = k / r1After;
            outClear = r0Before - r0After;
        }

        if (outClear < minOut) revert Slippage();
        if (outClear == 0) revert AmountTooSmall();

        // Transfer output token
        IERC20 outputToken = p.zeroForOne ? token1 : token0;
        outputToken.safeTransfer(p.recipient, outClear);

        // Update reserves with actual balances
        uint256 actualR0 = token0.balanceOf(address(this));
        uint256 actualR1 = token1.balanceOf(address(this));
        _updateReserves(_cast112(actualR0), _cast112(actualR1));
        _bumpEpoch(amountIn);
    }

    // ============================= Standard Swap (Public, no encryption) =============================

    /// @notice Standard public swap (like Uniswap V2)
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        bool zeroForOne,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        if (block.timestamp > deadline) revert Expired();
        if (amountIn == 0) revert ZeroAmount();
        if (recipient == address(0)) revert BadRecipient();

        uint256 r0Before = reserve0Last;
        uint256 r1Before = reserve1Last;
        if (r0Before == 0 || r1Before == 0) revert EmptyReserves();

        IERC20 inputToken = zeroForOne ? token0 : token1;
        inputToken.safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 amountInAfterFee = (amountIn * (1e6 - fee)) / 1e6;
        if (amountInAfterFee == 0) revert AmountTooSmall();

        uint256 k = r0Before * r1Before;
        uint256 r0After;
        uint256 r1After;

        if (zeroForOne) {
            r0After = r0Before + amountInAfterFee;
            r1After = k / r0After;
            amountOut = r1Before - r1After;
        } else {
            r1After = r1Before + amountInAfterFee;
            r0After = k / r1After;
            amountOut = r0Before - r0After;
        }

        if (amountOut < amountOutMin) revert Slippage();
        if (amountOut == 0) revert AmountTooSmall();

        IERC20 outputToken = zeroForOne ? token1 : token0;
        outputToken.safeTransfer(recipient, amountOut);

        uint256 actualR0 = token0.balanceOf(address(this));
        uint256 actualR1 = token1.balanceOf(address(this));
        _updateReserves(_cast112(actualR0), _cast112(actualR1));
        _bumpEpoch(amountIn);

        emit SwapPrivate(msg.sender, recipient, zeroForOne);
    }

    // ============================= Liquidity Management =============================

    /// @notice Add liquidity (both tokens)
    function addLiquidity(
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 amount1,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (uint256 tokenId) {
        if (block.timestamp > deadline) revert Expired();
        if (amount0 == 0 && amount1 == 0) revert ZeroAmount();
        if (recipient == address(0)) revert BadRecipient();
        if (tickLower >= tickUpper) revert BadRange();

        if (amount0 > 0) token0.safeTransferFrom(msg.sender, address(this), amount0);
        if (amount1 > 0) token1.safeTransferFrom(msg.sender, address(this), amount1);

        euint64 liquidityHandle = FHE.asEuint64(_cast64(amount0 + amount1));
        euint64 token0Handle = FHE.asEuint64(_cast64(amount0));
        euint64 token1Handle = FHE.asEuint64(_cast64(amount1));

        _allowHandle(liquidityHandle, address(this));
        _allowHandle(liquidityHandle, address(positionNFT));
        _allowHandle(liquidityHandle, recipient);

        _allowHandle(token0Handle, address(this));
        _allowHandle(token0Handle, address(positionNFT));
        _allowHandle(token0Handle, recipient);

        _allowHandle(token1Handle, address(this));
        _allowHandle(token1Handle, address(positionNFT));
        _allowHandle(token1Handle, recipient);

        tokenId = positionNFT.mint(
            recipient,
            address(token0),
            address(token1),
            tickLower,
            tickUpper,
            liquidityHandle,
            token0Handle,
            token1Handle,
            false
        );

        positionLiquidityToken0[tokenId] = amount0;
        positionLiquidityToken1[tokenId] = amount1;

        uint256 actualR0 = token0.balanceOf(address(this));
        uint256 actualR1 = token1.balanceOf(address(this));
        _updateReserves(_cast112(actualR0), _cast112(actualR1));

        emit MintLiquidity(msg.sender, recipient, tickLower, tickUpper);
    }

    /// @notice Remove liquidity
    function removeLiquidity(uint256 tokenId, uint256 deadline) external nonReentrant {
        if (block.timestamp > deadline) revert Expired();

        address ownerAddr = positionNFT.ownerOf(tokenId);
        if (ownerAddr != msg.sender) revert NotPositionOwner();

        uint256 share0 = positionLiquidityToken0[tokenId];
        uint256 share1 = positionLiquidityToken1[tokenId];
        if (share0 == 0 && share1 == 0) revert AmountTooSmall();

        delete positionLiquidityToken0[tokenId];
        delete positionLiquidityToken1[tokenId];

        if (share0 > 0) {
            if (share0 > reserve0Last) revert InsufficientLiquidity();
            token0.safeTransfer(ownerAddr, share0);
        }

        if (share1 > 0) {
            if (share1 > reserve1Last) revert InsufficientLiquidity();
            token1.safeTransfer(ownerAddr, share1);
        }

        IPositionNFT.Position memory position = positionNFT.getPosition(tokenId);
        positionNFT.burn(tokenId);

        uint256 actualR0 = token0.balanceOf(address(this));
        uint256 actualR1 = token1.balanceOf(address(this));
        _updateReserves(_cast112(actualR0), _cast112(actualR1));

        emit BurnLiquidity(ownerAddr, position.tickLower, position.tickUpper);
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
            userShare += positionLiquidityToken0[id] + positionLiquidityToken1[id];
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

    function getReserves() external view returns (uint112 r0, uint112 r1, uint32 lastUpdated) {
        return (reserve0Last, reserve1Last, blockTimestampLast);
    }

    function getEpochData() external view returns (uint256 volume, uint256 startTimestamp) {
        return (volumeEpoch, epochStart);
    }

    // ============================= Internal Functions =============================

    function _updateReserves(uint112 r0, uint112 r1) internal {
        reserve0Last = r0;
        reserve1Last = r1;
        blockTimestampLast = uint32(block.timestamp);
        emit ReservesUpdated(r0, r1);
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
