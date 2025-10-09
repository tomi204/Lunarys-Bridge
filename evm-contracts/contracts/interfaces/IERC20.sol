// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

interface ICERC20 {
    event Transfer(address indexed from, address indexed to);
    event Mint(address indexed to, uint64 amount);

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);

    function totalSupply() external view returns (euint64);

    function balanceOf(address account) external view returns (euint64);

    function transfer(address to, externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (bool);

    function mint(address to, uint64 amount) external;

    function requestFaucet() external;

    function updateFaucetConfig(uint64 _faucetAmount, uint256 _faucetCooldown) external;

    function canRequestFaucet(address user) external view returns (bool);

    function timeUntilNextFaucet(address user) external view returns (uint256);
}
