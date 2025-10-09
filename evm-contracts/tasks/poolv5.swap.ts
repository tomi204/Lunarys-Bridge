import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

// ==================== POOLV5 SWAPS (Public with Private Amounts) ====================

task("v5:swap:private", "Initiate private swap on PrivacyPoolV5 (async, encrypted amount)")
  .addParam("amount", "Amount to swap (uint64)")
  .addParam("direction", "Swap direction: 0=token0->token1, 1=token1->token0")
  .addOptionalParam("minout", "Minimum output", "0")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV5)")
  .addOptionalParam("ttl", "Seconds until deadline", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV5")).address;
    const [signer] = await ethers.getSigners();

    const pool = await ethers.getContractAt("PrivacyPoolV5", poolAddr, signer);

    const amountIn = Number(args.amount);
    const minOut = Number(args.minout ?? "0");
    const zeroForOne = args.direction === "0";
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    console.log(`📤 Initiating private swap: ${amountIn} (direction: ${zeroForOne ? "0->1" : "1->0"})`);

    // Encrypt amount and minOut
    const encAmount = await fhevm.createEncryptedInput(poolAddr, signer.address).add64(amountIn).encrypt();

    const encMinOut = await fhevm.createEncryptedInput(poolAddr, signer.address).add64(minOut).encrypt();

    // Initiate private swap
    console.log(`➡️  initiatePrivateSwap(...)`);
    const tx = await pool.initiatePrivateSwap(
      encAmount.handles[0],
      encMinOut.handles[0],
      zeroForOne,
      signer.address,
      encAmount.inputProof,
      encMinOut.inputProof,
      deadline,
    );

    console.log(`⏳ tx: ${tx.hash} (async, requestId will be in logs)`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);
    console.log(`⚠️  Wait for decryption callback to finalize swap`);
  });

task("v5:swap:public", "Standard public swap on PrivacyPoolV5 (no encryption)")
  .addParam("amount", "Amount to swap")
  .addParam("direction", "Swap direction: 0=token0->token1, 1=token1->token0")
  .addOptionalParam("minout", "Minimum output", "0")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV5)")
  .addOptionalParam("ttl", "Seconds until deadline", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV5")).address;
    const [signer] = await ethers.getSigners();

    const pool = await ethers.getContractAt("PrivacyPoolV5", poolAddr, signer);

    const amountIn = BigInt(args.amount);
    const minOut = BigInt(args.minout ?? "0");
    const zeroForOne = args.direction === "0";
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    console.log(`📤 Public swap: ${amountIn} (direction: ${zeroForOne ? "0->1" : "1->0"})`);

    // Get input token and approve
    const token0Addr = await pool.token0();
    const token1Addr = await pool.token1();
    const inputTokenAddr = zeroForOne ? token0Addr : token1Addr;
    const inputToken = await ethers.getContractAt("IERC20", inputTokenAddr, signer);

    console.log(`➡️  approve(${poolAddr}, ${amountIn})`);
    await (await inputToken.approve(poolAddr, amountIn)).wait();

    // Swap
    console.log(`➡️  swapExactTokensForTokens(...)`);
    const tx = await pool.swapExactTokensForTokens(amountIn, minOut, zeroForOne, signer.address, deadline);
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);

    const [r0, r1] = await pool.getReserves();
    console.log(`📊 Reserves => token0: ${r0.toString()} | token1: ${r1.toString()}`);
  });
