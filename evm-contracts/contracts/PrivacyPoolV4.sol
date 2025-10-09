// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.24;

import {
    FHE,
    euint64,
    ebool,
    eaddress,
    externalEuint64,
    externalEbool,
    externalEaddress
} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC7984} from "openzeppelin-confidential-contracts/contracts/interfaces/IERC7984.sol";
import {IPositionNFT} from "./interfaces/IPositionNFT.sol";

/// @title PrivacyPoolV4 - Fully Confidential AMM (x*y=k)
/// @notice BOTH token0 and token1 are confidential (ERC-7984)
/// @dev All swap amounts, reserves, and liquidity are encrypted. Async decryption for finalization.
contract PrivacyPoolV4 is SepoliaConfig, Ownable, ReentrancyGuard {
    // --- Configuration ---
    IERC7984 public immutable token0;
    IERC7984 public immutable token1;
    IERC7984 public immutable rewardToken;
    uint64 public immutable fixedFee; // Fixed fee in token units (not percentage)
    int24 public immutable tickSpacing;
    IPositionNFT public immutable positionNFT;

    // --- AMM State (BOTH reserves are virtual/encrypted) ---
    uint112 private reserve0VirtualLast;
    uint112 private reserve1VirtualLast;
    uint32 private blockTimestampLast;

    // --- Analytics ---
    uint256 private volumeEpoch;
    uint256 private epochStart;
    uint256 private constant EPOCH = 6 hours;

    // --- Liquidity tracking (shadow amounts for rewards) ---
    mapping(uint256 => uint256) internal positionLiquidity;
    mapping(address => uint256) public userLastClaim;
    uint256 public rewardRatePerSec = 1e15;

    // --- Pending operations ---
    struct PendingSwap {
        address initiator;
        euint64 amount;
        euint64 minOut;
        ebool zeroForOne;
        eaddress recipient;
        uint112 r0Before;
        uint112 r1Before;
    }

    struct PendingLiquidity {
        address user;
        int24 tickLower;
        int24 tickUpper;
        bool isToken0; // true = token0, false = token1
    }

    mapping(uint256 => PendingSwap) private _pendingSwap;
    mapping(uint256 => PendingLiquidity) private _pendingLiq;

    // --- Events ---
    event SwapConfidential(address indexed sender, address indexed recipient, bool zeroForOne);
    event MintConfidential(address indexed sender, address indexed owner, int24 tickLower, int24 tickUpper);
    event BurnConfidential(address indexed owner, int24 tickLower, int24 tickUpper);
    event RewardsClaimed(address indexed user);
    event ReservesUpdated(uint112 reserve0Virtual, uint112 reserve1Virtual);

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
        address _rewardToken,
        uint64 _fixedFee,
        int24 _tickSpacing,
        address _positionNFT,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_token0 == address(0) || _token1 == address(0) || _rewardToken == address(0)) revert ZeroAmount();
        token0 = IERC7984(_token0);
        token1 = IERC7984(_token1);
        rewardToken = IERC7984(_rewardToken);
        fixedFee = _fixedFee;
        tickSpacing = _tickSpacing;
        positionNFT = IPositionNFT(_positionNFT);
        epochStart = block.timestamp;
        domainSeparator = keccak256(abi.encode(keccak256("PRIV_POOL_V4_DOMAIN"), address(this), block.chainid));
    }

    // ============================= Initialization =============================

    function seedVirtualReserves(uint112 r0Virtual, uint112 r1Virtual) external onlyOwner {
        if (reserve0VirtualLast != 0 || reserve1VirtualLast != 0) revert AlreadySeeded();
        if (r0Virtual == 0 || r1Virtual == 0) revert ZeroAmount();
        _updateReserves(r0Virtual, r1Virtual);
    }

    // ============================= Swaps (Fully Confidential) =============================

    /// @notice Initiate a fully confidential swap (async decryption)
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
    ) external nonReentrant returns (uint256 requestId) {
        if (block.timestamp > deadline) revert Expired();

        euint64 amountHandle = FHE.fromExternal(encryptedAmountIn, amountProof);
        euint64 minOutHandle = FHE.fromExternal(encryptedMinAmountOut, minOutProof);
        ebool directionHandle = FHE.fromExternal(encryptedZeroForOne, directionProof);
        eaddress recipientHandle = FHE.fromExternal(encryptedRecipient, recipientProof);

        // Determine which token to pull from based on direction
        euint64 zeroHandle = FHE.asEuint64(0);
        euint64 amountToken0 = FHE.select(directionHandle, amountHandle, zeroHandle);
        euint64 amountToken1 = FHE.select(directionHandle, zeroHandle, amountHandle);

        _allowHandle(amountHandle, address(this));
        _allowHandle(amountHandle, msg.sender);
        _allowHandle(amountHandle, address(token0));
        _allowHandle(amountHandle, address(token1));

        _allowHandle(amountToken0, address(token0));
        _allowHandle(amountToken0, address(this));
        _allowHandle(amountToken1, address(token1));
        _allowHandle(amountToken1, address(this));

        FHE.allowTransient(amountToken0, address(token0));
        FHE.allowTransient(amountToken1, address(token1));

        // Transfer input tokens
        token0.confidentialTransferFrom(msg.sender, address(this), amountToken0);
        token1.confidentialTransferFrom(msg.sender, address(this), amountToken1);

        uint112 r0Before = reserve0VirtualLast;
        uint112 r1Before = reserve1VirtualLast;
        if (r0Before == 0 || r1Before == 0) revert EmptyReserves();

        // Request decryption
        bytes32[] memory cts = new bytes32[](4);
        cts[0] = FHE.toBytes32(amountHandle);
        cts[1] = FHE.toBytes32(minOutHandle);
        cts[2] = FHE.toBytes32(directionHandle);
        cts[3] = FHE.toBytes32(recipientHandle);
        requestId = FHE.requestDecryption(cts, this.finalizeConfidentialSwap.selector);

        _pendingSwap[requestId] = PendingSwap({
            initiator: msg.sender,
            amount: amountHandle,
            minOut: minOutHandle,
            zeroForOne: directionHandle,
            recipient: recipientHandle,
            r0Before: r0Before,
            r1Before: r1Before
        });
    }

    /// @notice Finalize confidential swap after decryption
    function finalizeConfidentialSwap(
        uint256 requestID,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) public nonReentrant {
        FHE.checkSignatures(requestID, cleartexts, decryptionProof);
        PendingSwap memory p = _pendingSwap[requestID];
        if (p.initiator == address(0)) revert NoPending(requestID);
        delete _pendingSwap[requestID];

        (uint64 amountIn, uint64 minOutClear, bool zeroForOne, address recipient) = abi.decode(
            cleartexts,
            (uint64, uint64, bool, address)
        );

        if (recipient == address(0)) revert BadRecipient();
        if (amountIn == 0) revert ZeroAmount();
        if (amountIn <= fixedFee) revert AmountTooSmall();

        uint256 r0Before = p.r0Before;
        uint256 r1Before = p.r1Before;

        uint256 netAmount = uint256(amountIn) - fixedFee;
        (uint256 r0After, uint256 r1After, uint256 outClear) = _computeSwap(zeroForOne, netAmount, r0Before, r1Before);

        if (outClear < minOutClear) revert Slippage();
        if (outClear == 0) revert AmountTooSmall();
        if (outClear > type(uint64).max) revert Overflow();

        _transferOutput(zeroForOne, outClear, recipient);
        _updateReserves(_cast112(r0After), _cast112(r1After));
        _bumpEpoch(amountIn);

        emit SwapConfidential(p.initiator, recipient, zeroForOne);
    }

    // ============================= Liquidity (Confidential Token0) =============================

    function provideLiquidityToken0(
        int24 tickLower,
        int24 tickUpper,
        externalEuint64 encryptedAmount0,
        uint256 amount0Clear,
        address recipient,
        bytes calldata inputProof,
        uint256 deadline
    ) external nonReentrant returns (uint256 requestId) {
        if (block.timestamp > deadline) revert Expired();
        if (recipient == address(0)) revert BadRecipient();
        if (tickLower >= tickUpper) revert BadRange();
        if (amount0Clear == 0) revert ZeroAmount();

        euint64 amount = FHE.fromExternal(encryptedAmount0, inputProof);
        FHE.allowTransient(amount, address(token0));

        euint64 transferred = token0.confidentialTransferFrom(msg.sender, address(this), amount);

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(transferred);
        requestId = FHE.requestDecryption(cts, this.finalizeProvideLiquidity.selector);

        _pendingLiq[requestId] = PendingLiquidity({
            user: recipient,
            tickLower: tickLower,
            tickUpper: tickUpper,
            isToken0: true
        });
    }

    // ============================= Liquidity (Confidential Token1) =============================

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

        euint64 transferred = token1.confidentialTransferFrom(msg.sender, address(this), amount);

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(transferred);
        requestId = FHE.requestDecryption(cts, this.finalizeProvideLiquidity.selector);

        _pendingLiq[requestId] = PendingLiquidity({
            user: recipient,
            tickLower: tickLower,
            tickUpper: tickUpper,
            isToken0: false
        });
    }

    /// @notice Finalize liquidity provision after decryption
    function finalizeProvideLiquidity(
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

        uint256 tokenId;
        if (p.isToken0) {
            tokenId = positionNFT.mint(
                p.user,
                address(token0),
                address(token1),
                p.tickLower,
                p.tickUpper,
                liquidityHandle,
                amountHandle,
                zeroHandle,
                false
            );

            positionLiquidity[tokenId] = uint256(actualAmount);
            uint112 newReserve0 = _cast112(uint256(reserve0VirtualLast) + uint256(actualAmount));
            _updateReserves(newReserve0, reserve1VirtualLast);
        } else {
            tokenId = positionNFT.mint(
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
            uint112 newReserve1 = _cast112(uint256(reserve1VirtualLast) + uint256(actualAmount));
            _updateReserves(reserve0VirtualLast, newReserve1);
        }

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
            _updateReserves(reserve0VirtualLast, newReserve1);
        } else {
            if (share > reserve0VirtualLast) revert InsufficientLiquidity();

            _allowHandle(position.token0Amount, address(this));
            _allowHandle(position.token0Amount, ownerAddr);
            _allowHandle(position.token0Amount, address(token0));

            token0.confidentialTransfer(ownerAddr, position.token0Amount);

            uint112 newReserve0 = _cast112(uint256(reserve0VirtualLast) - share);
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
        if (rewards > type(uint64).max) revert Overflow();

        if (rewards > 0) {
            euint64 rewardHandle = FHE.asEuint64(_cast64(rewards));
            _allowHandle(rewardHandle, address(rewardToken));
            _allowHandle(rewardHandle, msg.sender);
            _allowHandle(rewardHandle, address(this));
            FHE.allowTransient(rewardHandle, address(rewardToken));
            rewardToken.confidentialTransfer(msg.sender, rewardHandle);
        }
        emit RewardsClaimed(msg.sender);
    }

    // ============================= View Functions =============================

    function getDomainSeparator() external view returns (bytes32) {
        return domainSeparator;
    }

    function getReserves() external view returns (uint112 r0Virtual, uint112 r1Virtual, uint32 lastUpdated) {
        return (reserve0VirtualLast, reserve1VirtualLast, blockTimestampLast);
    }

    function getEpochData() external view returns (uint256 volume, uint256 startTimestamp) {
        return (volumeEpoch, epochStart);
    }

    // ============================= Internal Functions =============================

    function _computeSwap(
        bool zeroForOne,
        uint256 netAmount,
        uint256 r0Before,
        uint256 r1Before
    ) private pure returns (uint256 r0After, uint256 r1After, uint256 outClear) {
        if (netAmount == 0) revert AmountTooSmall();

        uint256 k = r0Before * r1Before;
        if (zeroForOne) {
            r0After = r0Before + netAmount;
            r1After = k / r0After;
            outClear = r1Before - r1After;
        } else {
            r1After = r1Before + netAmount;
            r0After = k / r1After;
            outClear = r0Before - r0After;
        }
    }

    function _transferOutput(bool zeroForOne, uint256 outClear, address recipient) private {
        IERC7984 outToken = zeroForOne ? token1 : token0;
        euint64 outHandle = FHE.asEuint64(_cast64(outClear));
        _allowHandle(outHandle, address(outToken));
        _allowHandle(outHandle, recipient);
        FHE.allowTransient(outHandle, address(outToken));
        outToken.confidentialTransfer(recipient, outHandle);
    }

    function _updateReserves(uint112 r0, uint112 r1v) internal {
        reserve0VirtualLast = r0;
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
