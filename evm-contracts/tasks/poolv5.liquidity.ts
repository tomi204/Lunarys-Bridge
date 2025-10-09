import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

// ==================== POOLV5 LIQUIDITY (Public Tokens) ====================

task("v5:addLiquidity", "Add liquidity to PrivacyPoolV5")
  .addParam("amount0", "Amount of token0")
  .addParam("amount1", "Amount of token1")
  .addOptionalParam("mintick", "minTick", "-120")
  .addOptionalParam("maxtick", "maxTick", "120")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV5)")
  .addOptionalParam("ttl", "Seconds until deadline", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV5")).address;
    const [signer] = await ethers.getSigners();

    const pool = await ethers.getContractAt("PrivacyPoolV5", poolAddr, signer);

    const amount0 = BigInt(args.amount0);
    const amount1 = BigInt(args.amount1);
    const tickLower = Number(args.mintick ?? "-120");
    const tickUpper = Number(args.maxtick ?? "120");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    console.log(`💰 Adding liquidity: ${amount0} token0, ${amount1} token1 (ticks: ${tickLower} to ${tickUpper})`);

    // Approve both tokens
    const token0Addr = await pool.token0();
    const token1Addr = await pool.token1();
    const token0 = await ethers.getContractAt("IERC20", token0Addr, signer);
    const token1 = await ethers.getContractAt("IERC20", token1Addr, signer);

    if (amount0 > 0n) {
      console.log(`➡️  approve token0(${poolAddr}, ${amount0})`);
      await (await token0.approve(poolAddr, amount0)).wait();
    }

    if (amount1 > 0n) {
      console.log(`➡️  approve token1(${poolAddr}, ${amount1})`);
      await (await token1.approve(poolAddr, amount1)).wait();
    }

    // Add liquidity
    console.log(`➡️  addLiquidity(...)`);
    const tx = await pool.addLiquidity(tickLower, tickUpper, amount0, amount1, signer.address, deadline);
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);

    const [r0, r1] = await pool.getReserves();
    console.log(`📊 Reserves => token0: ${r0.toString()} | token1: ${r1.toString()}`);
  });

task("v5:removeLiquidity", "Remove liquidity from PrivacyPoolV5")
  .addParam("tokenid", "Position NFT token ID")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV5)")
  .addOptionalParam("ttl", "Seconds until deadline", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV5")).address;
    const [signer] = await ethers.getSigners();

    const pool = await ethers.getContractAt("PrivacyPoolV5", poolAddr, signer);
    const tokenId = BigInt(args.tokenid);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    console.log(`🔥 Removing liquidity from tokenId: ${tokenId}`);

    const tx = await pool.removeLiquidity(tokenId, deadline);
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);

    const [r0, r1] = await pool.getReserves();
    console.log(`📊 Reserves => token0: ${r0.toString()} | token1: ${r1.toString()}`);
  });
