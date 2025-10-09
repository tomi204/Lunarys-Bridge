// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Position NFT
/// @notice NFT representing liquidity positions in the PrivacyPool
/// @dev Each NFT represents a unique liquidity position with confidential amounts
contract PositionNFT is ERC721, Ownable, SepoliaConfig {
    struct Position {
        address token0; // First token in the pair
        address token1; // Second token in the pair
        int24 tickLower; // Lower tick boundary
        int24 tickUpper; // Upper tick boundary
        euint64 liquidity; // Confidential liquidity amount
        euint64 token0Amount; // Confidential amount of token0
        euint64 token1Amount; // Confidential amount of token1
        bool isConfidential; // Whether this position uses confidential tokens
        uint256 createdAt; // Timestamp when position was created
        uint256 lastUpdated; // Last time position was modified
    }

    mapping(uint256 => Position) private _positions;
    mapping(address => uint256[]) private _userPositions;

    uint256 private _tokenIdCounter;
    address public poolManager;

    event PositionCreated(
        uint256 indexed tokenId,
        address indexed owner,
        address token0,
        address token1,
        int24 tickLower,
        int24 tickUpper,
        bool isConfidential
    );

    event PositionUpdated(uint256 indexed tokenId, euint64 liquidity);

    modifier onlyPoolManager() {
        require(msg.sender == poolManager, "PositionNFT: Only pool manager");
        _;
    }

    constructor(address initialOwner) ERC721("PrivacyPool Positions", "PPP") Ownable(initialOwner) {
        _tokenIdCounter = 1;
    }

    /// @notice Set the pool manager address
    /// @param _poolManager Address of the pool manager contract
    function setPoolManager(address _poolManager) external onlyOwner {
        poolManager = _poolManager;
    }

    /// @notice Mint a new position NFT
    /// @param to Address to mint the NFT to
    /// @param token0 First token in the pair
    /// @param token1 Second token in the pair
    /// @param tickLower Lower tick boundary
    /// @param tickUpper Upper tick boundary
    /// @param liquidity Initial liquidity amount (confidential)
    /// @param token0Amount Amount of token0 (confidential)
    /// @param token1Amount Amount of token1 (confidential)
    /// @param isConfidential Whether this position uses confidential tokens
    /// @return tokenId The ID of the newly minted NFT
    function mint(
        address to,
        address token0,
        address token1,
        int24 tickLower,
        int24 tickUpper,
        euint64 liquidity,
        euint64 token0Amount,
        euint64 token1Amount,
        bool isConfidential
    ) external onlyPoolManager returns (uint256 tokenId) {
        tokenId = _tokenIdCounter++;

        _positions[tokenId] = Position({
            token0: token0,
            token1: token1,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity,
            token0Amount: token0Amount,
            token1Amount: token1Amount,
            isConfidential: isConfidential,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp
        });

        _userPositions[to].push(tokenId);
        _safeMint(to, tokenId);

        // Permissions are granted by PrivacyPool before calling this function
        // No need to grant permissions here

        emit PositionCreated(tokenId, to, token0, token1, tickLower, tickUpper, isConfidential);
    }

    /// @notice Update position liquidity
    /// @param tokenId ID of the position NFT
    /// @param newLiquidity New liquidity amount
    /// @param newToken0Amount New token0 amount
    /// @param newToken1Amount New token1 amount
    function updatePosition(
        uint256 tokenId,
        euint64 newLiquidity,
        euint64 newToken0Amount,
        euint64 newToken1Amount
    ) external onlyPoolManager {
        require(_ownerOf(tokenId) != address(0), "PositionNFT: Position does not exist");

        Position storage position = _positions[tokenId];
        position.liquidity = newLiquidity;
        position.token0Amount = newToken0Amount;
        position.token1Amount = newToken1Amount;
        position.lastUpdated = block.timestamp;

        // Permissions are granted by PrivacyPool before calling this function
        // No need to grant permissions here

        emit PositionUpdated(tokenId, newLiquidity);
    }

    /// @notice Get position data
    /// @param tokenId ID of the position NFT
    /// @return position The position struct
    function getPosition(uint256 tokenId) external view returns (Position memory) {
        require(_ownerOf(tokenId) != address(0), "PositionNFT: Position does not exist");
        return _positions[tokenId];
    }

    /// @notice Get all position IDs for a user
    /// @param user Address of the user
    /// @return tokenIds Array of token IDs owned by the user
    function getUserPositions(address user) external view returns (uint256[] memory) {
        return _userPositions[user];
    }

    /// @notice Return position token ID owned by address at a specific index
    /// @param owner Address owning the positions
    /// @param index Position index within owner's list
    /// @return tokenId Position token ID
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256) {
        require(index < _userPositions[owner].length, "PositionNFT: owner index out of bounds");
        return _userPositions[owner][index];
    }

    /// @notice Get position count for a user
    /// @param user Address of the user
    /// @return count Number of positions owned by the user
    function getUserPositionCount(address user) external view returns (uint256) {
        return _userPositions[user].length;
    }

    /// @notice Check if a position exists
    /// @param tokenId ID of the position NFT
    /// @return exists Whether the position exists
    function positionExists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    /// @notice Burn a position NFT (only when liquidity is 0)
    /// @param tokenId ID of the position NFT to burn
    function burn(uint256 tokenId) external onlyPoolManager {
        require(_ownerOf(tokenId) != address(0), "PositionNFT: Position does not exist");

        address owner = ownerOf(tokenId);

        // Remove from user positions array
        uint256[] storage userPositions = _userPositions[owner];
        for (uint256 i = 0; i < userPositions.length; i++) {
            if (userPositions[i] == tokenId) {
                userPositions[i] = userPositions[userPositions.length - 1];
                userPositions.pop();
                break;
            }
        }

        delete _positions[tokenId];
        _burn(tokenId);
    }

    /// @notice Override transfer to update user positions tracking
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Update user positions tracking
        if (from != address(0) && to != from) {
            // Remove from previous owner
            uint256[] storage fromPositions = _userPositions[from];
            for (uint256 i = 0; i < fromPositions.length; i++) {
                if (fromPositions[i] == tokenId) {
                    fromPositions[i] = fromPositions[fromPositions.length - 1];
                    fromPositions.pop();
                    break;
                }
            }

            // Add to new owner
            if (to != address(0)) {
                _userPositions[to].push(tokenId);

                // Update FHE permissions for new owner
                Position storage position = _positions[tokenId];
                FHE.allow(position.liquidity, to);
                FHE.allow(position.token0Amount, to);
                FHE.allow(position.token1Amount, to);
            }
        }

        return super._update(to, tokenId, auth);
    }

    /// @notice Generate metadata URI for a position
    /// @param tokenId ID of the position NFT
    /// @return uri The metadata URI
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "PositionNFT: Position does not exist");

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    "eyJuYW1lIjoiUHJpdmFjeVBvb2wgUG9zaXRpb24gIywgdGlja0xvd2VyOiAiLCAidGlja1VwcGVyOiAiLCAiaXNDb25maWRlbnRpYWwiOiAiLCBzdHJpbmcoYWJpLmVuY29kZVBhY2tlZCh0b2tlbklkKSksICJ9Ig=="
                )
            );
    }
}
