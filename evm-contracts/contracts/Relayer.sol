// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Relayer - Cross-chain Bridge to Solana
/// @notice Relayer contract that allows withdrawing from pools and bridging to Solana
/// @dev Handles fee collection, pool withdrawals, and cross-chain bridging to Solana
contract Relayer is SepoliaConfig, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Constants ---
    /// @notice Solana chain ID identifier
    // uint256 public constant SOLANA_CHAIN_ID = 1399811149; // Solana mainnet chain ID

    // --- Configuration ---
    /// @notice Relayer address authorized to execute transactions
    address public relayer;

    /// @notice Fee percentage in basis points (e.g., 30 = 0.3%)
    uint256 public feePercentage = 30; // 0.3% default fee

    /// @notice Minimum fee amount
    uint256 public minFee = 1e15; // 0.001 tokens

    /// @notice Maximum fee amount
    uint256 public maxFee = 1e20; // 100 tokens

    // --- State Variables ---
    /// @notice Total fees collected per token
    mapping(address => uint256) public collectedFees;

    /// @notice Nonce for bridge operations
    uint256 public bridgeNonce;

    // --- Structures ---
    /// @notice Bridge request structure (EVM → Solana)
    struct BridgeRequest {
        address sender;
        address token;
        uint256 amount;
        eaddress encryptedSolanaDestination; // Encrypted Solana wallet address
        uint256 timestamp;
        bool finalized;
        uint256 fee;
    }

    /// @notice Bridge requests mapping
    mapping(uint256 => BridgeRequest) public bridgeRequests;

    // --- Events ---
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event FeePercentageUpdated(uint256 oldFee, uint256 newFee);
    event FeesCollected(address indexed token, uint256 amount, address indexed recipient);
    event BridgeInitiated(uint256 indexed requestId, address indexed sender, address token, uint256 amount);
    event BridgeFinalized(uint256 indexed requestId, address indexed relayer);
    event IncomingBridgeDelivered(address indexed recipient, address token, uint256 amount);

    // --- Errors ---
    error OnlyRelayer();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidFee();
    error RequestAlreadyFinalized();
    error RequestNotFound();

    // --- Modifiers ---
    modifier onlyRelayer() {
        if (msg.sender != relayer) revert OnlyRelayer();
        _;
    }

    /// @notice Contract constructor
    /// @param _relayer Initial relayer address
    /// @param initialOwner Initial contract owner
    constructor(address _relayer, address initialOwner) Ownable(initialOwner) {
        if (_relayer == address(0)) revert ZeroAddress();
        relayer = _relayer;
    }

    // ============================= Admin Functions =============================

    /// @notice Update relayer address
    /// @param newRelayer New relayer address
    function updateRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert ZeroAddress();
        address oldRelayer = relayer;
        relayer = newRelayer;
        emit RelayerUpdated(oldRelayer, newRelayer);
    }

    /// @notice Update fee percentage
    /// @param newFeePercentage New fee percentage in basis points
    function updateFeePercentage(uint256 newFeePercentage) external onlyOwner {
        if (newFeePercentage > 1000) revert InvalidFee(); // Max 10%
        uint256 oldFee = feePercentage;
        feePercentage = newFeePercentage;
        emit FeePercentageUpdated(oldFee, newFeePercentage);
    }

    /// @notice Update minimum and maximum fee amounts
    /// @param newMinFee New minimum fee
    /// @param newMaxFee New maximum fee
    function updateFeeLimits(uint256 newMinFee, uint256 newMaxFee) external onlyOwner {
        if (newMinFee >= newMaxFee) revert InvalidFee();
        minFee = newMinFee;
        maxFee = newMaxFee;
    }

    // ============================= Bridge EVM → Solana =============================

    /// @notice Initiate bridge to Solana with encrypted destination address
    /// @dev Relayer will decrypt off-chain and execute bridge to Solana
    /// @param token Token to bridge (standard ERC20)
    /// @param amount Amount to bridge (public)
    /// @param encryptedSolanaDestination Encrypted Solana wallet address
    /// @param destinationProof Proof for encrypted destination
    /// @return requestId Bridge request ID
    function initiateBridge(
        address token,
        uint256 amount,
        externalEaddress encryptedSolanaDestination,
        bytes calldata destinationProof
    ) external nonReentrant returns (uint256 requestId) {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        // Calculate fee
        uint256 fee = _calculateFee(amount);
        uint256 amountAfterFee = amount - fee;

        // Transfer tokens from sender
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Store fee
        collectedFees[token] += fee;

        // Create encrypted address handle
        eaddress destinationHandle = FHE.fromExternal(encryptedSolanaDestination, destinationProof);

        // Grant permissions: sender, this contract, and relayer can decrypt off-chain
        FHE.allow(destinationHandle, msg.sender);
        FHE.allow(destinationHandle, address(this));
        FHE.allow(destinationHandle, relayer);

        // Create bridge request with encrypted destination
        requestId = ++bridgeNonce;
        bridgeRequests[requestId] = BridgeRequest({
            sender: msg.sender,
            token: token,
            amount: amountAfterFee,
            encryptedSolanaDestination: destinationHandle,
            timestamp: block.timestamp,
            finalized: false,
            fee: fee
        });

        emit BridgeInitiated(requestId, msg.sender, token, amountAfterFee);
    }

    /// @notice Finalize bridge after relayer completes it on Solana (relayer only)
    /// @dev Relayer decrypts destination off-chain, sends to Solana, then calls this to mark as finalized
    /// @param requestId Bridge request ID
    function finalizeBridge(uint256 requestId) external onlyRelayer nonReentrant {
        BridgeRequest storage request = bridgeRequests[requestId];
        if (request.sender == address(0)) revert RequestNotFound();
        if (request.finalized) revert RequestAlreadyFinalized();

        request.finalized = true;

        emit BridgeFinalized(requestId, msg.sender);
    }

    // ============================= Bridge Solana → EVM =============================

    /// @notice Deliver tokens from Solana bridge (relayer only)
    /// @dev Relayer sends tokens to recipient after receiving them on Solana
    /// @param recipient Recipient address on EVM
    /// @param token Token address on EVM
    /// @param amount Amount to deliver
    function deliverTokens(address recipient, address token, uint256 amount) external onlyRelayer nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        // Transfer tokens to recipient
        IERC20(token).safeTransfer(recipient, amount);

        emit IncomingBridgeDelivered(recipient, token, amount);
    }

    /// @notice Collect accumulated fees
    /// @param token Token to collect fees from
    /// @param recipient Recipient of collected fees
    function collectFees(address token, address recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();

        uint256 fees = collectedFees[token];
        if (fees == 0) revert ZeroAmount();

        collectedFees[token] = 0;
        IERC20(token).safeTransfer(recipient, fees);

        emit FeesCollected(token, fees, recipient);
    }

    // ============================= View Functions =============================

    /// @notice Get bridge request details
    /// @param requestId Request ID
    /// @return Bridge request data
    function getBridgeRequest(uint256 requestId) external view returns (BridgeRequest memory) {
        return bridgeRequests[requestId];
    }

    /// @notice Get collected fees for a token
    /// @param token Token address
    /// @return Collected fees amount
    function getCollectedFees(address token) external view returns (uint256) {
        return collectedFees[token];
    }

    /// @notice Get contract balance for a specific token
    /// @param token Token address
    /// @return Balance held in contract
    function getContractBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // ============================= Internal Functions =============================

    /// @notice Calculate fee for an amount
    /// @param amount Amount to calculate fee for
    /// @return fee Calculated fee
    function _calculateFee(uint256 amount) internal view returns (uint256 fee) {
        fee = (amount * feePercentage) / 10000;

        // Apply min/max limits
        if (fee < minFee) {
            fee = minFee;
        }
        if (fee > maxFee) {
            fee = maxFee;
        }

        // Ensure fee doesn't exceed amount
        if (fee >= amount) {
            fee = amount / 2; // Emergency fallback: max 50% fee
        }
    }

    /// @notice Emergency withdrawal function
    /// @param token Token to withdraw
    /// @param amount Amount to withdraw
    /// @param recipient Recipient address
    function emergencyWithdraw(address token, uint256 amount, address recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransfer(recipient, amount);
    }
}
