
import { ethers } from "ethers";
import { ERC20_ABI } from "@/abi/erc20";
import { NEW_RELAYER_ABI } from "@/abi/newRelayer";

type EncryptFn = (solanaBase58: string) => Promise<{ handle: `0x${string}`; proof: `0x${string}` }>;

export async function evmToSolBridge({
  signer,
  ownerAddress,
  newRelayerAddress,
  tokenAddress,
  tokenDecimals,
  amountStr,
  destinationSolBase58,
  encryptSolanaDestination,
}: {
  signer: ethers.Signer;
  ownerAddress: `0x${string}`;
  newRelayerAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  tokenDecimals: number;
  amountStr: string;
  destinationSolBase58: string;
  encryptSolanaDestination: EncryptFn;
}): Promise<{ approvalTxHash?: string; bridgeTxHash: string }> {
  // 1) Encrypt destination
  const { handle, proof } = await encryptSolanaDestination(destinationSolBase58);

  // 2) Parse amount
  const sanitized = amountStr && amountStr.trim().length > 0 ? amountStr : "0";
  const parsed = ethers.parseUnits(sanitized, tokenDecimals);
  if (parsed <= 0n) throw new Error("Amount must be greater than zero");

  // 3) Approve if needed
  const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const currentAllowance: bigint = await erc20.allowance(ownerAddress, newRelayerAddress);

  let approvalTxHash: string | undefined;
  if (currentAllowance < parsed) {
    const approveTx = await erc20.approve(newRelayerAddress, parsed);
    const receipt = await approveTx.wait();
    approvalTxHash = receipt?.hash ?? approveTx.hash;
  }

  // 4) Call NewRelayer
  const relayer = new ethers.Contract(newRelayerAddress, NEW_RELAYER_ABI, signer);
  const tx = await relayer.initiateBridge(tokenAddress, parsed, handle, proof);
  const rec = await tx.wait();

  return { approvalTxHash, bridgeTxHash: rec?.hash ?? tx.hash };
}