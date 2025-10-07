import { keccak256, encodePacked, Hex } from 'viem';

export type BridgeMessage = {
  version: number;           // u8
  dir: number;               // u8 (1: SOL->EVM, 2: EVM->SOL)
  srcChainId: bigint;        // u256
  dstChainId: bigint;        // u256
  srcTxId: Hex;              // bytes32 (0x + 64 hex)
  originToken: Hex;          // bytes32
  amount: bigint;            // u256
  recipient: Hex;            // bytes32
  nonce: bigint;             // u256
  expiry: bigint;            // u256 (unix seconds)
};

export function encodeCanonical(m: BridgeMessage): Hex {
  return encodePacked(
    ['uint8','uint8','uint256','uint256','bytes32','bytes32','uint256','bytes32','uint256','uint256'],
    [
      m.version,
      m.dir,
      m.srcChainId,
      m.dstChainId,
      m.srcTxId,
      m.originToken,
      m.amount,
      m.recipient,
      m.nonce,
      m.expiry,
    ]
  );
}

export function computeMsgId(m: BridgeMessage): Hex {
  return keccak256(encodeCanonical(m));
}
