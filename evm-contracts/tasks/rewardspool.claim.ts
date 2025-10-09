import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

task("rewardspool:claim", "Claim rewards from the RewardsPool")
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

    // Check pending rewards
    const pending = await rewardsPool.pendingRewards(signer.address);
    console.log("💰 Pending rewards:", pending.toString(), "tokens");

    if (pending === 0n) {
      console.log("❌ No rewards to claim");
      return;
    }

    // Claim
    console.log("🎁 Claiming rewards...");
    const claimTx = await rewardsPool.claimRewards();
    const receipt = await claimTx.wait();
    console.log("✅ Claimed! Tx:", receipt?.hash);

    // Show updated stats
    const userStake = await rewardsPool.getUserStake(signer.address);
    console.log("\n📊 Your stake:");
    console.log("  Amount:", ethers.formatEther(userStake.amount), "tokens");
    console.log("  Accumulated rewards:", userStake.accumulatedRewards.toString());

    // Show rewards token balance (encrypted)
    const rewardsTokenAddress = await rewardsPool.rewardsToken();
    const rewardsToken = await ethers.getContractAt("CERC20", rewardsTokenAddress);
    const balanceHandle = await rewardsToken.confidentialBalanceOf(signer.address);
    console.log("\n🔒 Encrypted rewards balance handle:", balanceHandle);
    console.log("   (Use fhevm to decrypt this balance)");
  });
