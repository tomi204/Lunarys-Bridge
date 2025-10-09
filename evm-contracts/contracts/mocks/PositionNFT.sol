// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IPositionNFT} from "../interfaces/IPositionNFT.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";

contract MockPositionNFT is IPositionNFT {
    uint256 internal _nextId = 1;
    mapping(uint256 => address) internal _ownerOf;
    mapping(address => uint256[]) internal _owned;
    mapping(uint256 => Position) internal _positions;

    function mintEmpty(
        address to,
        address token0,
        address token1,
        int24 tickLower,
        int24 tickUpper
    ) external returns (uint256 tokenId) {
        tokenId = _nextId++;
        _ownerOf[tokenId] = to;
        _owned[to].push(tokenId);
        _positions[tokenId] = Position({
            token0: token0,
            token1: token1,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: FHE.asEuint64(0),
            token0Amount: FHE.asEuint64(0),
            token1Amount: FHE.asEuint64(0),
            isConfidential: false,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp
        });
    }

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
    ) external returns (uint256 tokenId) {
        tokenId = _nextId++;
        _ownerOf[tokenId] = to;
        _owned[to].push(tokenId);
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
    }

    function burn(uint256 tokenId) external {
        address o = _ownerOf[tokenId];
        require(o != address(0), "no token");
        delete _ownerOf[tokenId];
        delete _positions[tokenId];
        uint256[] storage arr = _owned[o];
        for (uint256 i; i < arr.length; i++)
            if (arr[i] == tokenId) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _owned[owner].length;
    }
    function tokenOfOwnerByIndex(address owner, uint256 idx) external view returns (uint256) {
        return _owned[owner][idx];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return _ownerOf[tokenId];
    }

    function getPosition(uint256 tokenId) external view returns (Position memory) {
        return _positions[tokenId];
    }
}
