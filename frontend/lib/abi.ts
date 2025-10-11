export const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

export const RELAYER_ABI = [
  "function initiateBridge(address token, uint256 amount, bytes encryptedSolanaDestination, bytes destinationProof) returns (uint256)",
];
