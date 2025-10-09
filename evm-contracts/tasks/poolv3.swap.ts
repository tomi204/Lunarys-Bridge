import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

// ==================== POOLV3 SWAPS ====================

task("v3:swap0to1", "Swap token0 -> token1 on PrivacyPoolV3")
  .addParam("amount", "Amount of token0 to swap (e.g., 1000)")
  .addOptionalParam("minout", "Minimum token1 output", "0")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV3)")
  .addOptionalParam("ttl", "Seconds until deadline", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV3")).address;
    const [signer] = await ethers.getSigners();

    const pool = await ethers.getContractAt("PrivacyPoolV3", poolAddr, signer);
    const token0Addr = await pool.token0();
    const token0 = await ethers.getContractAt("IERC20", token0Addr, signer);

    const amountIn = BigInt(args.amount);
    const minOut = BigInt(args.minout ?? "0");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    console.log(`📤 Swapping ${amountIn} token0 for token1 (minOut: ${minOut})`);

    // Approve
    console.log(`➡️  approve(${poolAddr}, ${amountIn})`);
    await (await token0.approve(poolAddr, amountIn)).wait();

    // Swap
    console.log(`➡️  swapToken0ForToken1(${amountIn}, ${minOut}, ${signer.address}, ${deadline})`);
    const tx = await pool.swapToken0ForToken1(amountIn, minOut, signer.address, deadline);
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);

    const [r0, r1v] = await pool.getReserves();
    console.log(`📊 Reserves => token0: ${r0.toString()} | token1Virtual: ${r1v.toString()}`);
  });

task("v3:swap1to0", "Swap token1 -> token0 on PrivacyPoolV3 (async)")
  .addParam("amount", "Amount of token1 to swap (uint64)")
  .addOptionalParam("minout", "Minimum token0 output", "0")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV3)")
  .addOptionalParam("token1", "CERC20 address (default: deployments/CERC20_V3)")
  .addOptionalParam("ttl", "Seconds until deadline", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV3")).address;
    const token1Addr = args.token1 ?? (await deployments.get("CERC20_V3")).address;

    const [signer] = await ethers.getSigners();
    const pool = await ethers.getContractAt("PrivacyPoolV3", poolAddr, signer);
    const token1 = await ethers.getContractAt("CERC20", token1Addr, signer);

    const amountIn = BigInt(args.amount);
    const minOut = BigInt(args.minout ?? "0");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    console.log(`📤 Swapping ${amountIn} token1 for token0 (minOut: ${minOut})`);

    // Set operator
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 2 * Number(args.ttl ?? "3600"));
    console.log(`➡️  setOperator(${poolAddr}, ${expiry})`);
    await (await token1.setOperator(poolAddr, expiry)).wait();

    // Encrypt amount
    const enc = await fhevm.createEncryptedInput(poolAddr, signer.address).add64(Number(amountIn)).encrypt();

    // Swap
    console.log(`➡️  swapToken1ForToken0ExactOut(...)`);
    const tx = await pool.swapToken1ForToken0ExactOut(enc.handles[0], minOut, signer.address, enc.inputProof, deadline);
    console.log(`⏳ tx: ${tx.hash} (async, requestId will be in logs)`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);
    console.log(`⚠️  Wait for decryption callback to finalize swap`);
  });
