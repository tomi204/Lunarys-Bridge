import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

// ==================== UNIVERSAL ROUTER TASKS ====================

task("router:register", "Register a pool in UniversalRouter")
  .addParam("pool", "Pool address")
  .addParam("poolversion", "Pool version: v3, v4, or v5")
  .addOptionalParam("router", "Router address (default: deployments/UniversalRouter)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const routerAddr = args.router ?? (await deployments.get("UniversalRouter")).address;
    const [signer] = await ethers.getSigners();

    const router = await ethers.getContractAt("UniversalRouter", routerAddr, signer);

    console.log(`📝 Registering pool ${args.pool} as ${args.poolversion}`);

    let tx = await router.registerPoolV5(args.pool);

    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ Pool registered: status=${rc?.status} gas=${rc?.gasUsed}`);
  });

task("router:pools", "List all registered pools in UniversalRouter")
  .addOptionalParam("router", "Router address (default: deployments/UniversalRouter)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const routerAddr = args.router ?? (await deployments.get("UniversalRouter")).address;
    const [signer] = await ethers.getSigners();

    const router = await ethers.getContractAt("UniversalRouter", routerAddr, signer);

    console.log(`📋 Fetching all registered pools...`);

    const pools = await router.getAllPools();

    if (pools.length === 0) {
      console.log("No pools registered");
      return;
    }

    console.log(`\nFound ${pools.length} pool(s):\n`);

    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i];
      const typeNames = ["V3_HYBRID", "V4_CONFIDENTIAL", "V5_PUBLIC"];
      console.log(`[${i + 1}] Pool: ${pool.poolAddress}`);
      // console.log(`    Type: ${typeNames[pool.poolType]}`);
      console.log(`    Token0: ${pool.token0}`);
      console.log(`    Token1: ${pool.token1}`);
      console.log(`    Active: ${pool.active}`);
      console.log("");
    }
  });

task("router:swapV3:0to1", "Swap token0->token1 via UniversalRouter on V3 pool")
  .addParam("token0", "Token0 address")
  .addParam("token1", "Token1 address")
  .addParam("amount", "Amount to swap")
  .addOptionalParam("minout", "Minimum output", "0")
  .addOptionalParam("router", "Router address (default: deployments/UniversalRouter)")
  .addOptionalParam("ttl", "Seconds until deadline", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const routerAddr = args.router ?? (await deployments.get("UniversalRouter")).address;
    const [signer] = await ethers.getSigners();

    const router = await ethers.getContractAt("UniversalRouter", routerAddr, signer);
    const token0 = await ethers.getContractAt("IERC20", args.token0, signer);

    const amountIn = BigInt(args.amount);
    const minOut = BigInt(args.minout ?? "0");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    console.log(`📤 Router swap (V3): ${amountIn} token0 -> token1`);

    // Approve router
    console.log(`➡️  approve(${routerAddr}, ${amountIn})`);
    await (await token0.approve(routerAddr, amountIn)).wait();

    // Swap via router
    console.log(`➡️  swapV3Token0ForToken1(...)`);
  });

task("router:swapV5:public", "Public swap via UniversalRouter on V5 pool")
  .addParam("token0", "Token0 address")
  .addParam("token1", "Token1 address")
  .addParam("amount", "Amount to swap")
  .addParam("direction", "Swap direction: 0=token0->token1, 1=token1->token0")
  .addOptionalParam("minout", "Minimum output", "0")
  .addOptionalParam("router", "Router address (default: deployments/UniversalRouter)")
  .addOptionalParam("ttl", "Seconds until deadline", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const routerAddr = args.router ?? (await deployments.get("UniversalRouter")).address;
    const [signer] = await ethers.getSigners();

    const router = await ethers.getContractAt("UniversalRouter", routerAddr, signer);

    const amountIn = BigInt(args.amount);
    const minOut = BigInt(args.minout ?? "0");
    const zeroForOne = args.direction === "0";
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    const inputTokenAddr = zeroForOne ? args.token0 : args.token1;
    const inputToken = await ethers.getContractAt("IERC20", inputTokenAddr, signer);

    console.log(`📤 Router swap (V5 public): ${amountIn} (direction: ${zeroForOne ? "0->1" : "1->0"})`);

    // Approve router
    console.log(`➡️  approve(${routerAddr}, ${amountIn})`);
    await (await inputToken.approve(routerAddr, amountIn)).wait();

    // Swap via router
    console.log(`➡️  swapV5Public(...)`);
    const tx = await router.swapV5Public(args.token0, args.token1, amountIn, minOut, zeroForOne, deadline);
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);
  });
