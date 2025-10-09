import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

task("rewardspool:unstake", "Unstake tokens from the RewardsPool")
  .addParam("amount", "Amount to unstake (in ether units)")
  .addOptionalParam("pool", "RewardsPool contract address")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre;
    const [signer] = await ethers.getSigners();

    console.log("🔐 Signer:", signer.address);

    // Get pool address
    let poolAddress = taskArgs.pool;
    if (!poolAddress) {
      const deployment = await hre.deployments.get("RewardsPool");
      poolAddress = deployment.address;
    }

    console.log("📍 RewardsPool:", poolAddress);

    // Get contract
    const rewardsPool = await ethers.getContractAt("RewardsPool", poolAddress);

    const amount = ethers.parseEther(taskArgs.amount);

    console.log("💸 Unstaking amount:", ethers.formatEther(amount), "tokens");

    // Check current stake
    const userStake = await rewardsPool.getUserStake(signer.address);
    console.log("📊 Current stake:", ethers.formatEther(userStake.amount), "tokens");

    if (userStake.amount < amount) {
      console.log("❌ Insufficient stake");
      return;
    }

    // Unstake
    console.log("📉 Unstaking...");
    const unstakeTx = await rewardsPool.unstake(amount);
    const receipt = await unstakeTx.wait();
    console.log("✅ Unstaked! Tx:", receipt?.hash);

    // Show updated stats
    const userStakeAfter = await rewardsPool.getUserStake(signer.address);
    console.log("\n📊 Your stake after unstaking:");
    console.log("  Amount:", ethers.formatEther(userStakeAfter.amount), "tokens");
    console.log("  Pending rewards:", await rewardsPool.pendingRewards(signer.address));

    const stats = await rewardsPool.getPoolStats();
    console.log("\n📊 Pool stats:");
    console.log("  Total staked:", ethers.formatEther(stats[0]), "tokens");
    console.log("  Current APY:", (Number(stats[1]) / 100).toFixed(2), "%");
  });
