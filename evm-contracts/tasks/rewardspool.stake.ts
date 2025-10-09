import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

task("rewardspool:stake", "Stake tokens in the RewardsPool")
  .addParam("amount", "Amount to stake (in ether units)")
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

    // Get contracts
    const rewardsPool = await ethers.getContractAt("RewardsPool", poolAddress);
    const stakingTokenAddress = await rewardsPool.stakingToken();
    const stakingToken = await ethers.getContractAt("contracts/mocks/MockERC20.sol:MockERC20", stakingTokenAddress);

    const amount = ethers.parseEther(taskArgs.amount);

    console.log("💰 Staking amount:", ethers.formatEther(amount), "tokens");

    // Check balance
    const balance = await stakingToken.balanceOf(signer.address);
    console.log("📊 Current balance:", ethers.formatEther(balance), "tokens");

    if (balance < amount) {
      console.log("❌ Insufficient balance");
      return;
    }

    // Approve
    console.log("✅ Approving tokens...");
    const approveTx = await stakingToken.approve(poolAddress, amount);
    await approveTx.wait();
    console.log("✅ Approved");

    // Stake
    console.log("📈 Staking...");
    const stakeTx = await rewardsPool.stake(amount);
    const receipt = await stakeTx.wait();
    console.log("✅ Staked! Tx:", receipt?.hash);

    // Show updated stats
    const userStake = await rewardsPool.getUserStake(signer.address);
    console.log("\n📊 Your stake:");
    console.log("  Amount:", ethers.formatEther(userStake.amount), "tokens");
    console.log("  Last update:", new Date(Number(userStake.lastUpdateTime) * 1000).toLocaleString());
    console.log("  Accumulated rewards:", userStake.accumulatedRewards.toString());

    const stats = await rewardsPool.getPoolStats();
    console.log("\n📊 Pool stats:");
    console.log("  Total staked:", ethers.formatEther(stats[0]), "tokens");
    console.log("  Current APY:", (Number(stats[1]) / 100).toFixed(2), "%");
  });
