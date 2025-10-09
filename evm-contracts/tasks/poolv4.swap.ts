import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

// ==================== POOLV4 SWAPS (Fully Confidential) ====================

task("v4:swap", "Initiate confidential swap on PrivacyPoolV4 (async)")
  .addParam("amount", "Amount to swap (uint64)")
  .addParam("direction", "Swap direction: 0=token0->token1, 1=token1->token0")
  .addOptionalParam("minout", "Minimum output", "0")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV4)")
  .addOptionalParam("ttl", "Seconds until deadline", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV4")).address;
    const [signer] = await ethers.getSigners();

    const pool = await ethers.getContractAt("PrivacyPoolV4", poolAddr, signer);

    const amountIn = Number(args.amount);
    const minOut = Number(args.minout ?? "0");
    const zeroForOne = args.direction === "0";
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    console.log(`📤 Initiating confidential swap: ${amountIn} (direction: ${zeroForOne ? "0->1" : "1->0"})`);

    // Encrypt parameters
    const encAmount = await fhevm.createEncryptedInput(poolAddr, signer.address).add64(amountIn).encrypt();

    const encMinOut = await fhevm.createEncryptedInput(poolAddr, signer.address).add64(minOut).encrypt();

    const encDirection = await fhevm.createEncryptedInput(poolAddr, signer.address).addBool(zeroForOne).encrypt();

    const encRecipient = await fhevm
      .createEncryptedInput(poolAddr, signer.address)
      .addAddress(signer.address)
      .encrypt();

    // Initiate swap
    console.log(`➡️  initiateConfidentialSwap(...)`);
    const tx = await pool.initiateConfidentialSwap(
      encAmount.handles[0],
      encMinOut.handles[0],
      encDirection.handles[0],
      encRecipient.handles[0],
      encAmount.inputProof,
      encMinOut.inputProof,
      encDirection.inputProof,
      encRecipient.inputProof,
      deadline,
    );

    console.log(`⏳ tx: ${tx.hash} (async, requestId will be in logs)`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);
    console.log(`⚠️  Wait for decryption callback to finalize swap`);
  });
