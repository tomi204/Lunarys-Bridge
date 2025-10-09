// packages/fhevm-hardhat-template/tasks/pool.init.ts
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:init-pool-manager", "Set the pool as manager of the PositionNFT")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV2)")
  .addOptionalParam("positionnft", "PositionNFT address (default: deployments/PositionNFT)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV2")).address;
    const posAddr = args.positionnft ?? (await deployments.get("PositionNFT")).address;

    const [signer] = await ethers.getSigners();
    const positionNFT = await ethers.getContractAt("PositionNFT", posAddr, signer);

    console.log(`➡️ setPoolManager(${poolAddr}) on PositionNFT ${posAddr}`);
    const tx = await positionNFT.setPoolManager(poolAddr);
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);
  });
