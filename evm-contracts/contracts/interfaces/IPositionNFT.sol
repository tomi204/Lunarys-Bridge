// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";

interface IPositionNFT {
    struct Position {
        address token0;
        address token1;
        int24 tickLower;
        int24 tickUpper;
        euint64 liquidity;
        euint64 token0Amount;
        euint64 token1Amount;
        bool isConfidential;
        uint256 createdAt;
        uint256 lastUpdated;
    }

    function mintEmpty(
        address to,
        address token0,
        address token1,
        int24 tickLower,
        int24 tickUpper
    ) external returns (uint256 tokenId);

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
    ) external returns (uint256 tokenId);

    function burn(uint256 tokenId) external;

    function balanceOf(address owner) external view returns (uint256);

    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);

    function ownerOf(uint256 tokenId) external view returns (address);

    function getPosition(uint256 tokenId) external view returns (Position memory);
}
