import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

task("rewardspool:info", "Get RewardsPool information")
  .addOptionalParam("pool", "RewardsPool contract address")
  .addOptionalParam("user", "User address to check")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre;
    const [signer] = await ethers.getSigners();

    // Get pool address
    let poolAddress = taskArgs.pool;
    if (!poolAddress) {
      const deployment = await hre.deployments.get("RewardsPool");
      poolAddress = deployment.address;
    }

    console.log("📍 RewardsPool:", poolAddress);

    // Get contract
    const rewardsPool = await ethers.getContractAt("RewardsPool", poolAddress);

    // Pool configuration
    console.log("\n⚙️  Pool Configuration:");
    const stakingTokenAddr = await rewardsPool.stakingToken();
    const rewardsTokenAddr = await rewardsPool.rewardsToken();
    console.log("  Staking Token:", stakingTokenAddr);
    console.log("  Rewards Token:", rewardsTokenAddr);

    const baseAPY = await rewardsPool.baseAPY();
    const minAPY = await rewardsPool.minAPY();
    const targetLiquidity = await rewardsPool.targetLiquidity();

    console.log("  Base APY:", (Number(baseAPY) / 100).toFixed(2), "%");
    console.log("  Min APY:", (Number(minAPY) / 100).toFixed(2), "%");
    console.log("  Target Liquidity:", ethers.formatEther(targetLiquidity), "tokens");

    // Pool stats
    const [totalStaked, currentAPY, rewardsPerSec] = await rewardsPool.getPoolStats();

    console.log("\n📊 Pool Statistics:");
    console.log("  Total Staked:", ethers.formatEther(totalStaked), "tokens");
    console.log("  Current APY:", (Number(currentAPY) / 100).toFixed(2), "%");
    console.log("  Rewards per Second:", rewardsPerSec.toString());

    // Calculate utilization rate
    if (targetLiquidity > 0n) {
      const utilization = (Number(totalStaked) / Number(targetLiquidity)) * 100;
      console.log("  Liquidity Utilization:", utilization.toFixed(2), "%");
    }

    // User info if provided or default to signer
    const userAddress = taskArgs.user || signer.address;
    console.log("\n👤 User Information:", userAddress);

    const userStake = await rewardsPool.getUserStake(userAddress);
    console.log("  Staked Amount:", ethers.formatEther(userStake.amount), "tokens");

    if (userStake.amount > 0n) {
      const lastUpdate = new Date(Number(userStake.lastUpdateTime) * 1000);
      console.log("  Last Update:", lastUpdate.toLocaleString());
      console.log("  Accumulated Rewards:", userStake.accumulatedRewards.toString());

      const pending = await rewardsPool.pendingRewards(userAddress);
      console.log("  Pending Rewards:", pending.toString(), "tokens");

      // Calculate user's share of pool
      const userShare = (Number(userStake.amount) / Number(totalStaked)) * 100;
      console.log("  Pool Share:", userShare.toFixed(4), "%");

      // Estimate daily rewards at current APY
      const dailyRewards = (Number(userStake.amount) * Number(currentAPY)) / (365 * 10000);
      console.log("  Est. Daily Rewards:", ethers.formatEther(dailyRewards.toString()), "tokens");

      // Estimate yearly rewards
      const yearlyRewards = (Number(userStake.amount) * Number(currentAPY)) / 10000;
      console.log("  Est. Yearly Rewards:", ethers.formatEther(yearlyRewards.toString()), "tokens");
    } else {
      console.log("  No stake in this pool");
    }

    // Check rewards token balance (encrypted)
    const rewardsToken = await ethers.getContractAt("CERC20", rewardsTokenAddr);
    const balanceHandle = await rewardsToken.confidentialBalanceOf(userAddress);
    console.log("\n🔒 Encrypted Rewards Token Balance Handle:", balanceHandle);
  });
