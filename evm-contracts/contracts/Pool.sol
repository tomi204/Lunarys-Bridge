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

/// @title Privacy Pool V2 (x*y=k) with confidential TOKEN1 (ERC-7984)
/// @notice Implementation without on-chain decryption. For confidential-to-public swaps, "exact output" mode is used:
/// the caller specifies `exactAmountOut` (clear token0) and proves in FHE that `amountInAfterFee` matches the required input.
/// @dev This contract implements an AMM with confidential token handling using FHE encryption for privacy preservation.
contract EPool is SepoliaConfig, Ownable, ReentrancyGuard {
    // --- Configuration ---
    /// @notice Confidential token0 (ERC-7984)
    IERC7984 public immutable token0;
    /// @notice Confidential token1 (ERC-7984)
    IERC7984 public immutable token1;
    /// @notice Dedicated protocol reward token (confidential)
    IERC7984 public immutable rewardToken;
    /// @notice Fixed fee collected per swap (expressed in token units)
    uint64 public immutable fixedFee;

    /// @notice Tick spacing for future compatibility (currently unused)
    int24 public immutable tickSpacing;
    /// @notice Position NFT contract for liquidity management
    IPositionNFT public immutable positionNFT;

    // --- AMM State (virtual reserves; confidential amounts are not exposed) ---
    /// @notice Snapshot of token0 balance (clear amount)
    uint112 private reserve0Last;
    /// @notice Virtual reserve of token1 (encrypted)
    uint112 private reserve1VirtualLast;
    /// @notice Last block timestamp when reserves were updated
    uint32 private blockTimestampLast;

    // --- Analytics (hourly buckets to prevent granular leakage) ---
    /// @notice Volume accumulator for current epoch
    uint256 private volumeEpoch;
    /// @notice Start timestamp of current epoch
    uint256 private epochStart;
    /// @notice Epoch duration (6 hours)
    uint256 private constant EPOCH = 6 hours;

    // --- Rewards Demo (shadow liquidity) ---
    /// @notice Reward rate per second (0.001 token0/s)
    uint256 public rewardRatePerSec = 1e15;
    /// @notice Shadow liquidity units mapping (non-confidential)
    mapping(uint256 => uint256) internal positionLiquidity;
    /// @notice Last claim timestamp per user
    mapping(address => uint256) public userLastClaim;

    // --- Async Swap Pending (confidential -> public EXACT OUTPUT) ---
    /// @notice Structure holding pending swap data for async decryption
    struct PendingSwap {
        /// @notice Address that initiated the swap
        address initiator;
        /// @notice Encrypted input amount handle
        euint64 amount;
        /// @notice Encrypted minimum output amount handle
        euint64 minOut;
        /// @notice Encrypted direction flag (true if token0 -> token1)
        ebool zeroForOne;
        /// @notice Encrypted recipient handle for the final delivery
        eaddress recipient;
        /// @notice Reserve0 before the swap
        uint112 r0Before;
        /// @notice Reserve1 before the swap
        uint112 r1Before;
    }
    /// @notice Pending swaps mapping by request ID
    mapping(uint256 requestId => PendingSwap) private _pending;

    // --- Events (amounts not included for privacy) ---
    /// @notice Emitted on confidential swap execution
    /// @param sender The address initiating the swap
    /// @param recipient The address receiving the swap output
    /// @param zeroForOne True if swapping token0 for token1, false otherwise
    event SwapConfidential(address indexed sender, address indexed recipient, bool zeroForOne);

    /// @notice Emitted on confidential liquidity mint
    /// @param sender The address performing the mint operation
    /// @param owner The owner of the liquidity position
    /// @param tickLower Lower tick boundary of the position
    /// @param tickUpper Upper tick boundary of the position
    event MintConfidential(address indexed sender, address indexed owner, int24 tickLower, int24 tickUpper);

    /// @notice Emitted on confidential liquidity burn
    /// @param owner The owner of the liquidity position being burned
    /// @param tickLower Lower tick boundary of the position
    /// @param tickUpper Upper tick boundary of the position
    event BurnConfidential(address indexed owner, int24 tickLower, int24 tickUpper);

    /// @notice Emitted when rewards are claimed
    /// @param user The address claiming rewards
    event RewardsClaimed(address indexed user);

    // --- Errors ---
    /// @notice Thrown when operation has expired (deadline exceeded)
    error Expired();
    /// @notice Thrown when zero amount is provided
    error ZeroAmount();
    /// @notice Thrown when invalid recipient address is provided
    error BadRecipient();
    error BadRange();
    /// @notice Thrown when slippage tolerance is exceeded
    error Slippage();
    /// @notice Thrown when pool reserves are empty
    error EmptyReserves();
    /// @notice Thrown when no pending swap exists for the given ID
    /// @param id The swap request ID
    error NoPending(uint256 id);
    /// @notice Thrown when virtual reserves are already seeded
    error AlreadySeeded();
    /// @notice Thrown when amount is too small for the operation
    error AmountTooSmall();
    /// @notice Thrown when arithmetic overflow occurs
    error Overflow();
    error NotPositionOwner();
    error InsufficientLiquidity();

    /// @notice Domain separator for cryptographic proofs (binds to contract + chain)
    bytes32 public immutable domainSeparator;

    /// @notice Contract constructor
    /// @param _token0 Confidential token0 address (ERC-7984)
    /// @param _token1 Confidential token1 address (ERC-7984)
    /// @param _rewardToken Confidential protocol reward token
    /// @param _fixedFee Fixed fee (in token units) charged per swap
    /// @param _tickSpacing Tick spacing for future compatibility
    /// @param _positionNFT Address of the PositionNFT contract
    /// @param initialOwner Address of the initial contract owner
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
        domainSeparator = keccak256(abi.encode(keccak256("PRIV_POOL_V2_DOMAIN"), address(this), block.chainid));
    }

    // ============================= Initialization / Admin =============================

    /// @notice Initialize virtual reserves (must be called before first swap)
    /// @dev Sets up initial virtual reserve for token1 and seeds token0 from contract balance
    /// @param r0Virtual Initial virtual reserve amount for token0
    /// @param r1Virtual Initial virtual reserve amount for token1
    function seedVirtualReserves(uint112 r0Virtual, uint112 r1Virtual) external onlyOwner {
        if (reserve0Last != 0 || reserve1VirtualLast != 0) revert AlreadySeeded();
        if (r0Virtual == 0 || r1Virtual == 0) revert ZeroAmount();

        _updateReserves(r0Virtual, r1Virtual);
    }

    // ============================= AMM Core (x*y=k) =============================

    /// @notice Initiates a fully confidential swap between token0 and token1.
    /// @dev All parameters are provided in encrypted form; the actual transfer is finalized once the
    ///      decryption oracle returns plaintexts via {finalizeSwap}. The caller prepays the confidential
    ///      input amount, and the contract only releases the encrypted output after the callback.
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

        euint64 zeroHandle = FHE.asEuint64(0);
        euint64 amountToken0 = FHE.select(directionHandle, amountHandle, zeroHandle);
        euint64 amountToken1 = FHE.select(directionHandle, zeroHandle, amountHandle);

        // Grant access so token contracts can pull the encrypted amounts.
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

        token0.confidentialTransferFrom(msg.sender, address(this), amountToken0);
        token1.confidentialTransferFrom(msg.sender, address(this), amountToken1);

        uint112 r0Before = reserve0Last;
        uint112 r1Before = reserve1VirtualLast;
        if (r0Before == 0 || r1Before == 0) revert EmptyReserves();

        bytes32[] memory cts = new bytes32[](4);
        cts[0] = FHE.toBytes32(amountHandle);
        cts[1] = FHE.toBytes32(minOutHandle);
        cts[2] = FHE.toBytes32(directionHandle);
        cts[3] = FHE.toBytes32(recipientHandle);
        requestId = FHE.requestDecryption(cts, this.finalizeSwap.selector);

        _pending[requestId] = PendingSwap({
            initiator: msg.sender,
            amount: amountHandle,
            minOut: minOutHandle,
            zeroForOne: directionHandle,
            recipient: recipientHandle,
            r0Before: r0Before,
            r1Before: r1Before
        });
    }

    /// @notice Finalize async swap after decryption
    /// @dev Validates decryption proof and completes the swap by delivering token0 output
    /// @param requestID The async decryption request ID
    /// @param cleartexts Decrypted plaintext values
    /// @param decryptionProof Cryptographic proof of correct decryption
    function finalizeSwap(
        uint256 requestID,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) public nonReentrant {
        FHE.checkSignatures(requestID, cleartexts, decryptionProof);
        PendingSwap memory p = _pending[requestID];
        if (p.initiator == address(0)) revert NoPending(requestID);
        delete _pending[requestID];

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

    /// @notice Allows users to provide liquidity with confidential token0 only
    function provideLiquidityToken0(
        int24 tickLower,
        int24 tickUpper,
        externalEuint64 encryptedAmount0,
        uint256 amount0Clear,
        address recipient,
        bytes calldata inputProof,
        uint256 deadline
    ) external nonReentrant returns (uint256 tokenId) {
        tokenId = _provideLiquidity(
            true,
            tickLower,
            tickUpper,
            encryptedAmount0,
            inputProof,
            amount0Clear,
            recipient,
            deadline
        );
    }

    /// @notice Allows users to provide liquidity with confidential token1 only
    function provideLiquidityToken1(
        int24 tickLower,
        int24 tickUpper,
        externalEuint64 encryptedAmountIn,
        uint256 amount1Clear,
        address recipient,
        bytes calldata inputProof,
        uint256 deadline
    ) external nonReentrant returns (uint256 tokenId) {
        tokenId = _provideLiquidity(
            false,
            tickLower,
            tickUpper,
            encryptedAmountIn,
            inputProof,
            amount1Clear,
            recipient,
            deadline
        );
    }

    function _provideLiquidity(
        bool isToken0,
        int24 tickLower,
        int24 tickUpper,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        uint256 amountClear,
        address recipient,
        uint256 deadline
    ) private returns (uint256 tokenId) {
        if (block.timestamp > deadline) revert Expired();
        if (recipient == address(0)) revert BadRecipient();
        if (tickLower >= tickUpper) revert BadRange();
        if (amountClear == 0) revert ZeroAmount();

        uint64 amount64 = _cast64(amountClear);
        euint64 amountHandle = FHE.fromExternal(encryptedAmount, inputProof);

        IERC7984 depositToken = isToken0 ? token0 : token1;
        IERC7984 counterToken = isToken0 ? token1 : token0;

        _allowHandle(amountHandle, address(this));
        _allowHandle(amountHandle, address(positionNFT));
        _allowHandle(amountHandle, recipient);
        _allowHandle(amountHandle, address(depositToken));
        _allowHandle(amountHandle, address(counterToken));

        FHE.allowTransient(amountHandle, address(depositToken));
        euint64 transferred = depositToken.confidentialTransferFrom(msg.sender, address(this), amountHandle);

        euint64 liquidityHandle = FHE.asEuint64(amount64);
        euint64 zeroHandle = FHE.asEuint64(0);

        _allowHandle(liquidityHandle, address(this));
        _allowHandle(liquidityHandle, address(positionNFT));
        _allowHandle(liquidityHandle, recipient);

        _allowHandle(zeroHandle, address(this));
        _allowHandle(zeroHandle, address(positionNFT));
        _allowHandle(zeroHandle, recipient);

        _allowHandle(transferred, address(this));
        _allowHandle(transferred, address(positionNFT));
        _allowHandle(transferred, recipient);
        _allowHandle(transferred, address(depositToken));

        if (isToken0) {
            tokenId = positionNFT.mint(
                recipient,
                address(token0),
                address(token1),
                tickLower,
                tickUpper,
                liquidityHandle,
                transferred,
                zeroHandle,
                false
            );

            positionLiquidity[tokenId] = amountClear;

            uint112 newReserve0 = _cast112(uint256(reserve0Last) + amountClear);
            _updateReserves(newReserve0, reserve1VirtualLast);
        } else {
            tokenId = positionNFT.mint(
                recipient,
                address(token0),
                address(token1),
                tickLower,
                tickUpper,
                liquidityHandle,
                zeroHandle,
                transferred,
                true
            );

            positionLiquidity[tokenId] = amountClear;

            uint112 newReserve1 = _cast112(uint256(reserve1VirtualLast) + amountClear);
            _updateReserves(reserve0Last, newReserve1);
        }

        emit MintConfidential(msg.sender, recipient, tickLower, tickUpper);
    }

    /// @notice Burns an entire liquidity position and returns the supplied tokens
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

            _allowHandle(position.token0Amount, address(this));
            _allowHandle(position.token0Amount, ownerAddr);
            _allowHandle(position.token0Amount, address(token0));

            token0.confidentialTransfer(ownerAddr, position.token0Amount);

            uint112 newReserve0 = _cast112(uint256(reserve0Last) - share);
            _updateReserves(newReserve0, reserve1VirtualLast);
        }

        positionNFT.burn(tokenId);
        emit BurnConfidential(ownerAddr, position.tickLower, position.tickUpper);
    }

    // ============================= Liquidity Management =============================

    /// @notice Mint liquidity position (confidential)
    /// @dev Creates a new liquidity position NFT and assigns shadow liquidity
    /// @param tickLower Lower tick boundary of the position
    /// @param tickUpper Upper tick boundary of the position
    /// @param liquidityShadow Shadow liquidity amount (non-confidential)
    /// @param owner Owner address of the liquidity position
    /// @param deadline Timestamp after which the transaction expires
    /// @return tokenId ID of the newly minted position NFT
    function mintLiquidity(
        int24 tickLower,
        int24 tickUpper,
        uint256 liquidityShadow,
        address owner,
        uint256 deadline
    ) external nonReentrant onlyOwner returns (uint256 tokenId) {
        if (block.timestamp > deadline) revert Expired();
        require(owner != address(0), "bad owner");
        tokenId = positionNFT.mintEmpty(owner, address(token0), address(token1), tickLower, tickUpper);
        positionLiquidity[tokenId] = liquidityShadow;
        emit MintConfidential(msg.sender, owner, tickLower, tickUpper);
    }

    /// @notice Burn liquidity position (confidential)
    /// @dev Burns the position NFT and removes shadow liquidity
    /// @param tokenId ID of the position NFT to burn
    /// @param deadline Timestamp after which the transaction expires
    function burnLiquidity(uint256 tokenId, uint256 deadline) external nonReentrant onlyOwner {
        if (block.timestamp > deadline) revert Expired();
        positionNFT.burn(tokenId);
        delete positionLiquidity[tokenId];
        emit BurnConfidential(msg.sender, 0, 0);
    }

    // ============================= Rewards =============================

    /// @notice Claim liquidity rewards
    /// @dev Calculates and distributes rewards based on shadow liquidity positions
    /// @return rewards Amount of token0 rewards claimed
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

    /// @notice Get domain separator for cryptographic proofs
    /// @return Domain separator hash
    function getDomainSeparator() external view returns (bytes32) {
        return domainSeparator;
    }

    /// @notice Get current pool reserves
    /// @return r0 Current token0 reserve (public)
    /// @return r1Virtual Current token1 virtual reserve (encrypted)
    /// @return lastUpdated Timestamp of last reserve update
    function getReserves() external view returns (uint112 r0, uint112 r1Virtual, uint32 lastUpdated) {
        return (reserve0Last, reserve1VirtualLast, blockTimestampLast);
    }

    /// @notice Get current epoch analytics data
    /// @return volume Total volume in current epoch
    /// @return startTimestamp Epoch start timestamp
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
            uint256 r0AfterTmp = r0Before + netAmount;
            if (r0AfterTmp == 0) revert AmountTooSmall();
            r0After = r0AfterTmp;
            r1After = k / r0AfterTmp;
            outClear = r1Before - r1After;
        } else {
            uint256 r1AfterTmp = r1Before + netAmount;
            if (r1AfterTmp == 0) revert AmountTooSmall();
            r1After = r1AfterTmp;
            r0After = k / r1AfterTmp;
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

    /// @notice Update pool reserves
    /// @dev Updates both token reserves and last update timestamp
    /// @param r0 New token0 reserve
    /// @param r1v New token1 virtual reserve
    function _updateReserves(uint112 r0, uint112 r1v) internal {
        reserve0Last = r0;
        reserve1VirtualLast = r1v;
        blockTimestampLast = uint32(block.timestamp);
    }

    /// @notice Grants access to an encrypted handle for a specific account
    /// @param handle Encrypted value handle
    /// @param account Address to grant access to
    function _allowHandle(euint64 handle, address account) private {
        FHE.allow(handle, account);
    }

    /// @notice Safely cast uint256 to uint112
    /// @dev Reverts on overflow
    /// @param value Value to cast
    /// @return Casted uint112 value
    function _cast112(uint256 value) private pure returns (uint112) {
        if (value > type(uint112).max) revert Overflow();
        return uint112(value);
    }

    /// @notice Safely cast uint256 to uint64
    /// @dev Reverts on overflow
    /// @param value Value to cast
    /// @return Casted uint64 value
    function _cast64(uint256 value) private pure returns (uint64) {
        if (value > type(uint64).max) revert Overflow();
        return uint64(value);
    }

    /// @notice Update epoch volume accumulator
    /// @dev Resets epoch if time threshold exceeded, otherwise accumulates
    /// @param amountToken0 Volume amount to add
    function _bumpEpoch(uint256 amountToken0) internal {
        if (block.timestamp - epochStart >= EPOCH) {
            volumeEpoch = amountToken0;
            epochStart = block.timestamp;
        } else {
            volumeEpoch += amountToken0;
        }
    }
}
