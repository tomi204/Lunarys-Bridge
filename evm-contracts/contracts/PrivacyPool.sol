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

/// @title Privacy Pool V2 (x*y=k) with confidential TOKEN1 (ERC-7984)
/// @notice Implementation without on-chain decryption. For confidential-to-public swaps, "exact output" mode is used:
/// the caller specifies `exactAmountOut` (clear token0) and proves in FHE that `amountInAfterFee` matches the required input.
/// @dev This contract implements an AMM with confidential token handling using FHE encryption for privacy preservation.
contract PrivacyPoolV2 is SepoliaConfig, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Configuration ---
    /// @notice Public token (ERC-20)
    IERC20 public immutable token0;
    /// @notice Confidential token (ERC-7984)
    IERC7984 public immutable token1;
    /// @notice Fee in basis points (1e6 = 100%, typical value: 3000 = 0.3%)
    uint24 public immutable fee;

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
        /// @notice Recipient address for the swap output
        address recipient;
        /// @notice Minimum output amount required
        uint256 minOut;
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
    /// @param _token0 Address of the public token (ERC-20)
    /// @param _token1 Address of the confidential token (ERC-7984)
    /// @param _fee Fee in basis points (e.g., 3000 = 0.3%)
    /// @param _tickSpacing Tick spacing for future compatibility
    /// @param _positionNFT Address of the PositionNFT contract
    /// @param initialOwner Address of the initial contract owner
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
        fee = _fee; // e.g., 3000 = 0.3%
        tickSpacing = _tickSpacing;
        positionNFT = IPositionNFT(_positionNFT);

        epochStart = block.timestamp;
        domainSeparator = keccak256(abi.encode(keccak256("PRIV_POOL_V2_DOMAIN"), address(this), block.chainid));
    }

    // ============================= Initialization / Admin =============================

    /// @notice Initialize virtual reserves (must be called before first swap)
    /// @dev Sets up initial virtual reserve for token1 and seeds token0 from contract balance
    /// @param r1Virtual Initial virtual reserve amount for token1
    function seedVirtualReserves(uint112 r1Virtual) external onlyOwner {
        if (reserve0Last != 0 || reserve1VirtualLast != 0) revert AlreadySeeded();
        if (r1Virtual == 0) revert ZeroAmount();

        uint256 r0 = token0.balanceOf(address(this));
        if (r0 == 0) revert EmptyReserves();

        _updateReserves(_cast112(r0), r1Virtual);
    }

    // ============================= AMM Core (x*y=k) =============================

    /// @notice Swap token0 for token1 (public -> confidential)
    /// @dev Executes a swap from public token0 to confidential token1 using constant product formula
    /// @param amountIn Amount of token0 to swap in
    /// @param amountOutMin Minimum amount of token1 to receive
    /// @param recipient Address to receive the token1 output
    /// @param deadline Timestamp after which the transaction expires
    /// @return amountOut Encrypted amount of token1 received
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

        // Reservas antes del swap
        uint256 reserve0 = token0.balanceOf(address(this));
        uint256 r0Before = reserve0 - amountIn; // estado previo
        uint256 r1Before = reserve1VirtualLast;
        if (r0Before == 0 || r1Before == 0) revert EmptyReserves();

        // In neto
        uint256 amountInAfterFee = (amountIn * (1e6 - fee)) / 1e6;
        if (amountInAfterFee == 0) revert AmountTooSmall();
        // x*y=k: out = r1 - k/(r0+in)
        uint256 k = r0Before * r1Before;
        uint256 r0After = r0Before + amountInAfterFee;
        uint256 r1After = k / r0After;
        uint256 outClear = r1Before - r1After;
        if (outClear < amountOutMin) revert Slippage();
        if (outClear == 0) revert AmountTooSmall();
        if (outClear > type(uint64).max) revert Overflow();

        // Emitir confidencial
        amountOut = FHE.asEuint64(_cast64(outClear));
        FHE.allowTransient(amountOut, address(token1));
        token1.confidentialTransfer(recipient, amountOut);

        _updateReserves(_cast112(r0After), _cast112(r1After));
        _bumpEpoch(amountIn);
        emit SwapConfidential(msg.sender, recipient, true);
    }

    /// @notice Initiate swap token1 for token0 in EXACT OUTPUT mode (confidential -> public)
    /// @dev Transfers confidential input to pool and requests async decryption of actual received amount.
    /// Token0 delivery occurs in `finalizeSwap` after signature validation.
    /// @param encryptedAmountIn Encrypted amount of token1 to swap
    /// @param amountOutMin Minimum amount of token0 to receive
    /// @param recipient Address to receive the token0 output
    /// @param inputProof Cryptographic proof for the encrypted input
    /// @param deadline Timestamp after which the transaction expires
    /// @return requestId ID for tracking the async decryption request
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

        // snapshot reserves
        uint256 r0Balance = token0.balanceOf(address(this));
        if (r0Balance == 0) revert EmptyReserves();
        uint112 r0Before = _cast112(r0Balance);
        uint112 r1Before = reserve1VirtualLast;
        if (r0Before == 0 || r1Before == 0) revert EmptyReserves();

        // get encrypted amount and transfer TOKEN1 to pool
        euint64 amount = FHE.fromExternal(encryptedAmountIn, inputProof);
        FHE.allowTransient(amount, address(token1));
        euint64 amountTransferred = token1.confidentialTransferFrom(msg.sender, address(this), amount);

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(amountTransferred);
        requestId = FHE.requestDecryption(cts, this.finalizeSwap.selector);

        _pending[requestId] = PendingSwap({
            recipient: recipient,
            minOut: amountOutMin,
            r0Before: r0Before,
            r1Before: r1Before
        });

        emit SwapConfidential(msg.sender, recipient, false);
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
        uint64 amountIn = abi.decode(cleartexts, (uint64));
        if (p.recipient == address(0)) revert NoPending(requestID);
        delete _pending[requestID];

        uint256 r0Before = p.r0Before;
        uint256 r1Before = p.r1Before;

        uint256 inAfterFee = (uint256(amountIn) * (1e6 - fee)) / 1e6;
        if (inAfterFee == 0) revert AmountTooSmall();

        uint256 k = r0Before * r1Before;
        uint256 r1After = r1Before + inAfterFee;
        uint256 r0After = k / r1After;
        uint256 outClear = r0Before - r0After;
        if (outClear < p.minOut) revert Slippage();
        if (outClear == 0) revert AmountTooSmall();

        token0.safeTransfer(p.recipient, outClear);
        _updateReserves(_cast112(r0After), _cast112(r1After));
        _bumpEpoch(outClear);
    }

    /// @notice Allows users to provide liquidity with public token0 only
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

        uint256 currentBalance = token0.balanceOf(address(this));
        _updateReserves(_cast112(currentBalance), reserve1VirtualLast);

        emit MintConfidential(msg.sender, recipient, tickLower, tickUpper);
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
        if (block.timestamp > deadline) revert Expired();
        if (recipient == address(0)) revert BadRecipient();
        if (tickLower >= tickUpper) revert BadRange();
        if (amount1Clear == 0) revert ZeroAmount();

        uint64 amount64 = _cast64(amount1Clear);

        euint64 amount = FHE.fromExternal(encryptedAmountIn, inputProof);
        FHE.allow(amount, address(this));
        FHE.allow(amount, address(positionNFT));
        FHE.allow(amount, recipient);
        FHE.allow(amount, address(token1));

        FHE.allowTransient(amount, address(token1));
        euint64 amountTransferred = token1.confidentialTransferFrom(msg.sender, address(this), amount);

        FHE.allow(amountTransferred, address(this));
        FHE.allow(amountTransferred, address(positionNFT));
        FHE.allow(amountTransferred, recipient);
        FHE.allow(amountTransferred, address(token1));

        euint64 liquidityHandle = FHE.asEuint64(amount64);
        euint64 zeroHandle = FHE.asEuint64(0);

        _allowHandle(liquidityHandle, address(this));
        _allowHandle(liquidityHandle, address(positionNFT));
        _allowHandle(liquidityHandle, recipient);

        _allowHandle(zeroHandle, address(this));
        _allowHandle(zeroHandle, address(positionNFT));
        _allowHandle(zeroHandle, recipient);

        _allowHandle(amountTransferred, address(this));
        _allowHandle(amountTransferred, address(positionNFT));
        _allowHandle(amountTransferred, recipient);
        _allowHandle(amountTransferred, address(token1));

        tokenId = positionNFT.mint(
            recipient,
            address(token0),
            address(token1),
            tickLower,
            tickUpper,
            liquidityHandle,
            zeroHandle,
            amountTransferred,
            true
        );

        positionLiquidity[tokenId] = amount1Clear;

        uint112 newReserve1 = _cast112(uint256(reserve1VirtualLast) + amount1Clear);
        _updateReserves(reserve0Last, newReserve1);

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

            token0.safeTransfer(ownerAddr, share);
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
        uint256 poolBal = token0.balanceOf(address(this));
        if (poolBal == 0) {
            emit RewardsClaimed(msg.sender);
            return 0;
        }

        uint256 cap = poolBal / 1000;
        if (cap == 0) cap = poolBal;
        if (rewards > cap) rewards = cap; // cap rewards to available liquidity slice

        if (rewards > 0) token0.safeTransfer(msg.sender, rewards);
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
