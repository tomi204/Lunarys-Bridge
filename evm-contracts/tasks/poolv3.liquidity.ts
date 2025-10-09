import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

// ==================== POOLV3 LIQUIDITY ====================

task("v3:provide0", "Provide liquidity with token0 (public) on PrivacyPoolV3")
  .addParam("amount", "Amount of token0 (e.g., 1000)")
  .addOptionalParam("mintick", "minTick", "-120")
  .addOptionalParam("maxtick", "maxTick", "120")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV3)")
  .addOptionalParam("ttl", "Seconds until deadline", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV3")).address;
    const [signer] = await ethers.getSigners();

    const pool = await ethers.getContractAt("PrivacyPoolV3", poolAddr, signer);
    const token0Addr = await pool.token0();
    const token0 = await ethers.getContractAt("IERC20", token0Addr, signer);

    const amount0 = BigInt(args.amount);
    const tickLower = Number(args.mintick ?? "-120");
    const tickUpper = Number(args.maxtick ?? "120");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    console.log(`💰 Providing ${amount0} token0 to pool (ticks: ${tickLower} to ${tickUpper})`);

    // Approve
    console.log(`➡️  approve(${poolAddr}, ${amount0})`);
    await (await token0.approve(poolAddr, amount0)).wait();

    // Provide liquidity
    console.log(`➡️  provideLiquidityToken0(...)`);
    const tx = await pool.provideLiquidityToken0(tickLower, tickUpper, amount0, signer.address, deadline);
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);

    const [r0, r1v] = await pool.getReserves();
    console.log(`📊 Reserves => token0: ${r0.toString()} | token1Virtual: ${r1v.toString()}`);
  });

task("v3:provide1", "Provide liquidity with token1 (confidential) on PrivacyPoolV3 (async)")
  .addParam("amount", "Amount of token1 (uint64)")
  .addOptionalParam("mintick", "minTick", "-90")
  .addOptionalParam("maxtick", "maxTick", "90")
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

    const amount1 = BigInt(args.amount);
    const tickLower = Number(args.mintick ?? "-90");
    const tickUpper = Number(args.maxtick ?? "90");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    console.log(`💰 Providing ${amount1} token1 to pool (ticks: ${tickLower} to ${tickUpper})`);

    // Set operator
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 2 * Number(args.ttl ?? "3600"));
    console.log(`➡️  setOperator(${poolAddr}, ${expiry})`);
    await (await token1.setOperator(poolAddr, expiry)).wait();

    // Encrypt amount
    const enc = await fhevm.createEncryptedInput(poolAddr, signer.address).add64(Number(amount1)).encrypt();

    // Provide liquidity
    console.log(`➡️  provideLiquidityToken1(...)`);
    const tx = await pool.provideLiquidityToken1(
      tickLower,
      tickUpper,
      enc.handles[0],
      Number(amount1),
      signer.address,
      enc.inputProof,
      deadline,
    );
    console.log(`⏳ tx: ${tx.hash} (async, requestId will be in logs)`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);
    console.log(`⚠️  Wait for decryption callback to finalize liquidity provision`);
  });

task("v3:burn", "Burn liquidity position on PrivacyPoolV3")
  .addParam("tokenid", "Position NFT token ID")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV3)")
  .addOptionalParam("ttl", "Seconds until deadline", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV3")).address;
    const [signer] = await ethers.getSigners();

    const pool = await ethers.getContractAt("PrivacyPoolV3", poolAddr, signer);
    const tokenId = BigInt(args.tokenid);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    console.log(`🔥 Burning position tokenId: ${tokenId}`);

    const tx = await pool.burnPosition(tokenId, deadline);
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);

    const [r0, r1v] = await pool.getReserves();
    console.log(`📊 Reserves => token0: ${r0.toString()} | token1Virtual: ${r1v.toString()}`);
  });
