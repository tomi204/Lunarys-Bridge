// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title NewRelayer - Competitive Fast-Bridge (EVM ↔ Solana)
/// @notice Nodes (solvers) compete by claiming requests with a bond; the relayer (ours)
///         verifies off-chain and releases on-chain payout (amount+fee) to the winning solver.
contract NewRelayer is SepoliaConfig, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================= Roles / Config =============================

    /// @notice Authorized relayer/verifier to confirm cross-chain evidence (off-chain)
    address public relayer;

    /// @notice Fee in basis points (e.g., 30 = 0.3%)
    uint256 public feePercentage = 30; // 0.3% default

    /// @notice Minimum fee limit (in bridged token units)
    uint256 public minFee = 1e15; // 0.001 tokens

    /// @notice Maximum fee limit
    uint256 public maxFee = 1e20; // 100 tokens

    /// @notice Time window to fulfill a claimed request
    uint256 public claimWindow = 20 minutes;

    /// @notice Minimum bond (ETH) required from solver to claim
    uint256 public minSolverBond = 0.02 ether;

    /// @notice Percentage of bond to slash on expiry (bps)
    uint256 public slashBps = 5000; // 50%

    /// @notice Recipient of slashed funds
    address public slashCollector;

    /// @notice Whitelist of authorized nodes/solvers
    mapping(address => bool) public authorizedNodes;

    /// @notice Array to track all authorized nodes
    address[] public nodesList;

    // ============================= State =============================

    /// @notice Incremental nonce for request IDs
    uint256 public bridgeNonce;

    /// @notice Legacy fees per token (not used in competitive flow)
    mapping(address => uint256) public collectedFees;

    /// @notice EVM → Solana request
    struct BridgeRequest {
        address sender;
        address token;
        uint256 amount; // net (post-fee) held in escrow
        eaddress encryptedSolanaDestination;
        uint256 timestamp;
        bool finalized;
        uint256 fee; // fee for THIS request
    }

    mapping(uint256 => BridgeRequest) public bridgeRequests;

    /// @notice Competitive claim per request
    struct Claim {
        address solver;
        uint64 claimedAt;
        uint64 deadline;
        uint256 bond; // in ETH
    }

    mapping(uint256 => Claim) public requestClaim;

    /// @notice Fee in escrow per request (in same token)
    mapping(uint256 => uint256) public requestFeeEscrow;

    // ============================= Events =============================

    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event FeePercentageUpdated(uint256 oldFee, uint256 newFee);
    event FeeLimitsUpdated(uint256 newMinFee, uint256 newMaxFee);

    event BridgeInitiated(uint256 indexed requestId, address indexed sender, address token, uint256 amountAfterFee);

    event BridgeClaimed(uint256 indexed requestId, address indexed solver, uint256 bond, uint64 deadline);

    event BridgeClaimExpired(uint256 indexed requestId, address indexed oldSolver, uint256 slashed);

    /// @dev Simple version: only hashes
    event BridgeVerified(uint256 indexed requestId, address indexed relayer, bytes32 destTxHash, bytes32 evidenceHash);

    /// @dev Overload with URL (string) ONLY in event (not storage)
    event BridgeVerifiedURL(
        uint256 indexed requestId,
        address indexed relayer,
        bytes32 destTxHash,
        bytes32 evidenceHash,
        string evidenceURL
    );

    event BridgePaidToSolver(uint256 indexed requestId, address indexed solver, address token, uint256 payoutAmount);

    event SolverBondRefunded(uint256 indexed requestId, address indexed solver, uint256 refundedBond);

    event IncomingBridgeDelivered(address indexed recipient, address token, uint256 amount);

    event FeesCollected(address indexed token, uint256 amount, address indexed recipient);

    event NodeAuthorized(address indexed node);
    event NodeRevoked(address indexed node);

    // ============================= Errors =============================

    error OnlyRelayer();
    error NotAuthorizedNode();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidFee();
    error RequestAlreadyFinalized();
    error RequestNotFound();
    error ActiveClaim();
    error NotSolver();
    error ClaimExpired();
    error NoClaim();
    error BondTooLow();

    // ============================= Modifiers =============================

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert OnlyRelayer();
        _;
    }

    modifier onlyAuthorizedNode() {
        if (!authorizedNodes[msg.sender]) revert NotAuthorizedNode();
        _;
    }

    // ============================= Constructor =============================

    constructor(address _relayer, address initialOwner) Ownable(initialOwner) {
        if (_relayer == address(0)) revert ZeroAddress();
        relayer = _relayer;
        slashCollector = initialOwner;
    }

    // ============================= Admin =============================

    function updateRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert ZeroAddress();
        address oldRelayer = relayer;
        relayer = newRelayer;
        emit RelayerUpdated(oldRelayer, newRelayer);
    }

    function updateFeePercentage(uint256 newFeePercentage) external onlyOwner {
        if (newFeePercentage > 1000) revert InvalidFee(); // Max 10%
        uint256 oldFee = feePercentage;
        feePercentage = newFeePercentage;
        emit FeePercentageUpdated(oldFee, newFeePercentage);
    }

    function updateFeeLimits(uint256 newMinFee, uint256 newMaxFee) external onlyOwner {
        if (newMinFee >= newMaxFee) revert InvalidFee();
        minFee = newMinFee;
        maxFee = newMaxFee;
        emit FeeLimitsUpdated(newMinFee, newMaxFee);
    }

    function updateClaimWindow(uint256 newWindow) external onlyOwner {
        require(newWindow >= 1 minutes && newWindow <= 24 hours, "claimWindow out of range");
        claimWindow = newWindow;
    }

    function updateMinSolverBond(uint256 newMinBond) external onlyOwner {
        minSolverBond = newMinBond;
    }

    function updateSlashParams(uint256 newSlashBps, address newCollector) external onlyOwner {
        require(newSlashBps <= 10_000, "slashBps too high");
        slashBps = newSlashBps;
        slashCollector = newCollector;
    }

    /// @notice Authorize a node/solver to claim bridge requests
    function authorizeNode(address node) external onlyOwner {
        if (node == address(0)) revert ZeroAddress();
        if (!authorizedNodes[node]) {
            authorizedNodes[node] = true;
            nodesList.push(node);
            emit NodeAuthorized(node);
        }
    }

    /// @notice Revoke authorization from a node/solver
    function revokeNode(address node) external onlyOwner {
        if (authorizedNodes[node]) {
            authorizedNodes[node] = false;
            emit NodeRevoked(node);
        }
    }

    /// @notice Get total number of authorized nodes
    function getAuthorizedNodesCount() external view returns (uint256) {
        return nodesList.length;
    }

    /// @notice Get all authorized nodes
    function getAuthorizedNodes() external view returns (address[] memory) {
        uint256 count = 0;
        // Count active nodes
        for (uint256 i = 0; i < nodesList.length; i++) {
            if (authorizedNodes[nodesList[i]]) {
                count++;
            }
        }

        // Build active nodes array
        address[] memory activeNodes = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < nodesList.length; i++) {
            if (authorizedNodes[nodesList[i]]) {
                activeNodes[index] = nodesList[i];
                index++;
            }
        }
        return activeNodes;
    }

    // ============================= EVM → Solana =============================

    /// @notice Initiates a request; fee remains in escrow per request.
    ///         FHE permission is granted to relayer for off-chain verification.
    function initiateBridge(
        address token,
        uint256 amount,
        externalEaddress encryptedSolanaDestination,
        bytes calldata destinationProof
    ) external nonReentrant returns (uint256 requestId) {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 fee = _calculateFee(amount);
        uint256 amountAfterFee = amount - fee;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Create encrypted handle and grant base permissions + relayer (for off-chain verification)
        eaddress destinationHandle = FHE.fromExternal(encryptedSolanaDestination, destinationProof);
        FHE.allow(destinationHandle, msg.sender);
        FHE.allow(destinationHandle, address(this));
        FHE.allow(destinationHandle, relayer); // <- key: relayer can read destination

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

        requestFeeEscrow[requestId] = fee;

        emit BridgeInitiated(requestId, msg.sender, token, amountAfterFee);
    }

    /// @notice Solver claims the request (posts bond) and receives temporary FHE permission.
    function claimBridge(uint256 requestId) external payable nonReentrant onlyAuthorizedNode {
        BridgeRequest storage req = bridgeRequests[requestId];
        if (req.sender == address(0)) revert RequestNotFound();
        if (req.finalized) revert RequestAlreadyFinalized();

        Claim storage c = requestClaim[requestId];

        // Active and non-expired claim → cannot be taken
        if (c.solver != address(0) && block.timestamp < c.deadline) revert ActiveClaim();

        // If expired, slash and release
        if (c.solver != address(0) && block.timestamp >= c.deadline) {
            uint256 slashAmt = (c.bond * slashBps) / 10_000;
            uint256 leftover = c.bond - slashAmt;
            c.bond = 0;

            if (slashAmt > 0 && slashCollector != address(0)) {
                (bool ok, ) = payable(slashCollector).call{value: slashAmt}("");
                require(ok, "Slash transfer failed");
            }
            if (leftover > 0) {
                (bool ok2, ) = payable(c.solver).call{value: leftover}("");
                require(ok2, "Bond refund failed");
            }

            emit BridgeClaimExpired(requestId, c.solver, slashAmt);

            // reset
            c.solver = address(0);
            c.claimedAt = 0;
            c.deadline = 0;
        }

        if (msg.value < minSolverBond) revert BondTooLow();

        // Register new claim
        c.solver = msg.sender;
        c.claimedAt = uint64(block.timestamp);
        c.deadline = uint64(block.timestamp + claimWindow);
        c.bond = msg.value;

        // Grant FHE permission to current solver for off-chain destination/tx verification
        FHE.allow(req.encryptedSolanaDestination, msg.sender);

        emit BridgeClaimed(requestId, msg.sender, msg.value, c.deadline);
    }

    /// @notice Verifies off-chain and settles on-chain (relayer only) — simple version.
    function verifyAndSettle(
        uint256 requestId,
        bytes32 destTxHash,
        bytes32 evidenceHash
    ) external onlyRelayer nonReentrant {
        _verifyAndPay(requestId, destTxHash, evidenceHash, "");
        emit BridgeVerified(requestId, msg.sender, destTxHash, evidenceHash);
    }

    /// @notice Verifies off-chain and settles on-chain (relayer only) — with URL in event.
    function verifyAndSettle(
        uint256 requestId,
        bytes32 destTxHash,
        bytes32 evidenceHash,
        string calldata evidenceURL
    ) external onlyRelayer nonReentrant {
        _verifyAndPay(requestId, destTxHash, evidenceHash, evidenceURL);
        emit BridgeVerifiedURL(requestId, msg.sender, destTxHash, evidenceHash, evidenceURL);
    }

    /// @dev Common verification+settlement logic. Actual verification happens off-chain.
    function _verifyAndPay(
        uint256 requestId,
        bytes32 /*destTxHash*/,
        bytes32 /*evidenceHash*/,
        string memory /*evidenceURL*/
    ) internal {
        BridgeRequest storage req = bridgeRequests[requestId];
        if (req.sender == address(0)) revert RequestNotFound();
        if (req.finalized) revert RequestAlreadyFinalized();

        Claim storage c = requestClaim[requestId];
        if (c.solver == address(0)) revert NoClaim();
        if (block.timestamp > c.deadline) revert ClaimExpired();

        // Settlement: amount (escrow) + fee (escrow) → solver
        uint256 fee = requestFeeEscrow[requestId];
        requestFeeEscrow[requestId] = 0;

        uint256 payout = req.amount + fee;
        req.finalized = true;

        IERC20(req.token).safeTransfer(c.solver, payout);
        emit BridgePaidToSolver(requestId, c.solver, req.token, payout);

        // Refund bond
        uint256 bond = c.bond;
        c.bond = 0;
        (bool ok, ) = payable(c.solver).call{value: bond}("");
        require(ok, "Bond refund failed");
        emit SolverBondRefunded(requestId, c.solver, bond);

        // Cleanup claim
        c.solver = address(0);
        c.claimedAt = 0;
        c.deadline = 0;
    }

    /// @notice Releases an expired claim by executing slash (without claiming it)
    function releaseExpiredClaim(uint256 requestId) external nonReentrant {
        Claim storage c = requestClaim[requestId];
        if (c.solver == address(0)) revert NoClaim();
        if (block.timestamp < c.deadline) revert ActiveClaim();

        uint256 slashAmt = (c.bond * slashBps) / 10_000;
        uint256 leftover = c.bond - slashAmt;
        c.bond = 0;

        if (slashAmt > 0 && slashCollector != address(0)) {
            (bool ok, ) = payable(slashCollector).call{value: slashAmt}("");
            require(ok, "Slash transfer failed");
        }
        if (leftover > 0) {
            (bool ok2, ) = payable(c.solver).call{value: leftover}("");
            require(ok2, "Bond refund failed");
        }

        emit BridgeClaimExpired(requestId, c.solver, slashAmt);

        c.solver = address(0);
        c.claimedAt = 0;
        c.deadline = 0;
    }

    // ============================= Solana → EVM (compat) =============================

    /// @notice Delivers tokens (classic reverse flow) — relayer only
    function deliverTokens(address recipient, address token, uint256 amount) external onlyRelayer nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransfer(recipient, amount);
        emit IncomingBridgeDelivered(recipient, token, amount);
    }

    // ============================= Legacy fees =============================

    /// @notice Collects legacy fees (does not include fees in escrow for competitive requests)
    function collectFees(address token, address recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 fees = collectedFees[token];
        if (fees == 0) revert ZeroAmount();

        collectedFees[token] = 0;
        IERC20(token).safeTransfer(recipient, fees);
        emit FeesCollected(token, fees, recipient);
    }

    // ============================= Views =============================

    function getBridgeRequest(uint256 requestId) external view returns (BridgeRequest memory) {
        return bridgeRequests[requestId];
    }

    function getCollectedFees(address token) external view returns (uint256) {
        return collectedFees[token];
    }

    function getContractBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // ============================= Internal =============================

    function _calculateFee(uint256 amount) internal view returns (uint256 fee) {
        fee = (amount * feePercentage) / 10000;

        if (fee < minFee) fee = minFee;
        if (fee > maxFee) fee = maxFee;

        // safety for small amounts
        if (fee >= amount) {
            fee = amount / 2; // hard fallback: max 50%
        }
    }

    /// @notice Emergency: withdraw tokens (admin)
    function emergencyWithdraw(address token, uint256 amount, address recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(recipient, amount);
    }
}
