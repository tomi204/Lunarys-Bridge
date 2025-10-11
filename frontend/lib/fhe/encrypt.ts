// frontend/lib/fhe/encrypt.ts
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/web";
import { ethers } from "ethers";

type Hex = `0x${string}`;

let _fheInstance: Awaited<ReturnType<typeof createInstance>> | undefined;

export async function getFheInstance() {
  if (_fheInstance) return _fheInstance;
  _fheInstance = await createInstance(SepoliaConfig);
  return _fheInstance;
}

export function aliasAddressFromSolanaBase58(base58: string): `0x${string}` {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(base58));
  const alias = ethers.getAddress(ethers.dataSlice(hash, 12));
  return alias as `0x${string}`;
}

function toHex(data: Uint8Array | string): Hex {
  const h =
    typeof data === "string"
      ? (data.startsWith("0x") ? data : ethers.hexlify(ethers.toUtf8Bytes(data)))
      : ethers.hexlify(data);
  return h as Hex;
}

export async function encryptEaddressForContract(params: {
  contractAddress: `0x${string}`;
  userAddress: `0x${string}`;
  evmAliasAddress: `0x${string}`;
}): Promise<{ handle: Hex; proof: Hex }> {
  const fhe = await getFheInstance();

  const buf = fhe.createEncryptedInput(params.contractAddress, params.userAddress);
  buf.addAddress(params.evmAliasAddress);

  const { handles, inputProof } = await buf.encrypt();

  
  const handleHex = toHex(handles[0] as any);
  const proofHex = toHex(inputProof as any);

  return { handle: handleHex, proof: proofHex };
}
