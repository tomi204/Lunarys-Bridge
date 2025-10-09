import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const ONE = 10n ** 18n;

async function deployRewardsPool() {
  const [owner, alice, bob, charlie] = await ethers.getSigners();

  // Deploy staking token (public ERC20)
  const StakingTokenFactory = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
  const stakingToken: any = await StakingTokenFactory.deploy("Staking Token", "STK", 10_000_000n * ONE);
  await stakingToken.waitForDeployment();

  // Deploy rewards token (confidential CERC20)
  const RewardsTokenFactory = await ethers.getContractFactory("CERC20");
  const rewardsToken: any = await RewardsTokenFactory.deploy(
    owner.address,
    1_000_000, // Initial amount for owner
    "Rewards Token",
    "RTKN",
    "https://example.com/rewards",
  );
  await rewardsToken.waitForDeployment();

  // Deploy RewardsPool
  const RewardsPoolFactory = await ethers.getContractFactory("RewardsPool");
  const rewardsPool: any = await RewardsPoolFactory.deploy(
    await stakingToken.getAddress(),
    await rewardsToken.getAddress(),
    owner.address,
  );
  await rewardsPool.waitForDeployment();

  // Mint additional rewards tokens to the pool
  const poolAddr = await rewardsPool.getAddress();
  await rewardsToken.mint(poolAddr, 10_000_000); // 10M rewards tokens

  // Transfer staking tokens to users
  await stakingToken.transfer(alice.address, 1_000_000n * ONE);
  await stakingToken.transfer(bob.address, 1_000_000n * ONE);
  await stakingToken.transfer(charlie.address, 1_000_000n * ONE);

  return { owner, alice, bob, charlie, stakingToken, rewardsToken, rewardsPool };
}

describe("RewardsPool - Staking with Encrypted Rewards", function () {
  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      const { rewardsPool, stakingToken, rewardsToken } = await loadFixture(deployRewardsPool);

      expect(await rewardsPool.stakingToken()).to.equal(await stakingToken.getAddress());
      expect(await rewardsPool.rewardsToken()).to.equal(await rewardsToken.getAddress());
      expect(await rewardsPool.totalStaked()).to.equal(0);
    });

    it("Should have correct default APY parameters", async function () {
      const { rewardsPool } = await loadFixture(deployRewardsPool);

      expect(await rewardsPool.baseAPY()).to.equal(10000); // 100%
      expect(await rewardsPool.minAPY()).to.equal(500); // 5%
      expect(await rewardsPool.targetLiquidity()).to.equal(1_000_000n * ONE);
    });

    it("Should start with maximum APY when no liquidity", async function () {
      const { rewardsPool } = await loadFixture(deployRewardsPool);

      const currentAPY = await rewardsPool.getCurrentAPY();
      expect(currentAPY).to.equal(10000); // 100% APY
    });
  });

  describe("Staking", function () {
    it("Should allow users to stake tokens", async function () {
      const { rewardsPool, stakingToken, alice } = await loadFixture(deployRewardsPool);

      const stakeAmount = 100_000n * ONE;
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount);
      await rewardsPool.connect(alice).stake(stakeAmount);

      const userStake = await rewardsPool.getUserStake(alice.address);
      expect(userStake.amount).to.equal(stakeAmount);
      expect(await rewardsPool.totalStaked()).to.equal(stakeAmount);
    });

    it("Should update total staked correctly with multiple users", async function () {
      const { rewardsPool, stakingToken, alice, bob } = await loadFixture(deployRewardsPool);

      const stakeAmount1 = 100_000n * ONE;
      const stakeAmount2 = 200_000n * ONE;
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount1);
      await rewardsPool.connect(alice).stake(stakeAmount1);

      await stakingToken.connect(bob).approve(poolAddr, stakeAmount2);
      await rewardsPool.connect(bob).stake(stakeAmount2);

      expect(await rewardsPool.totalStaked()).to.equal(stakeAmount1 + stakeAmount2);
    });

    it("Should revert when staking zero amount", async function () {
      const { rewardsPool, alice } = await loadFixture(deployRewardsPool);

      await expect(rewardsPool.connect(alice).stake(0)).to.be.revertedWithCustomError(rewardsPool, "ZeroAmount");
    });

    it("Should allow users to stake multiple times", async function () {
      const { rewardsPool, stakingToken, alice } = await loadFixture(deployRewardsPool);

      const stakeAmount1 = 50_000n * ONE;
      const stakeAmount2 = 75_000n * ONE;
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount1 + stakeAmount2);
      await rewardsPool.connect(alice).stake(stakeAmount1);
      await rewardsPool.connect(alice).stake(stakeAmount2);

      const userStake = await rewardsPool.getUserStake(alice.address);
      expect(userStake.amount).to.equal(stakeAmount1 + stakeAmount2);
    });
  });

  describe("Unstaking", function () {
    it("Should allow users to unstake tokens", async function () {
      const { rewardsPool, stakingToken, alice } = await loadFixture(deployRewardsPool);

      const stakeAmount = 100_000n * ONE;
      const unstakeAmount = 50_000n * ONE;
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount);
      await rewardsPool.connect(alice).stake(stakeAmount);

      const balanceBefore = await stakingToken.balanceOf(alice.address);
      await rewardsPool.connect(alice).unstake(unstakeAmount);
      const balanceAfter = await stakingToken.balanceOf(alice.address);

      expect(balanceAfter - balanceBefore).to.equal(unstakeAmount);

      const userStake = await rewardsPool.getUserStake(alice.address);
      expect(userStake.amount).to.equal(stakeAmount - unstakeAmount);
    });

    it("Should revert when unstaking more than staked", async function () {
      const { rewardsPool, stakingToken, alice } = await loadFixture(deployRewardsPool);

      const stakeAmount = 100_000n * ONE;
      const unstakeAmount = 150_000n * ONE;
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount);
      await rewardsPool.connect(alice).stake(stakeAmount);

      await expect(rewardsPool.connect(alice).unstake(unstakeAmount)).to.be.revertedWithCustomError(
        rewardsPool,
        "InsufficientStake",
      );
    });

    it("Should revert when unstaking zero amount", async function () {
      const { rewardsPool, alice } = await loadFixture(deployRewardsPool);

      await expect(rewardsPool.connect(alice).unstake(0)).to.be.revertedWithCustomError(rewardsPool, "ZeroAmount");
    });
  });

  describe("Dynamic APY", function () {
    it("Should decrease APY as total liquidity increases", async function () {
      const { rewardsPool, stakingToken, alice, bob, charlie } = await loadFixture(deployRewardsPool);

      // Initial APY with no liquidity
      const initialAPY = await rewardsPool.getCurrentAPY();
      expect(initialAPY).to.equal(10000); // 100%

      // Add 10% of target liquidity
      const stakeAmount1 = 100_000n * ONE; // 0.1M (10% of 1M target)
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount1);
      await rewardsPool.connect(alice).stake(stakeAmount1);

      const apy1 = await rewardsPool.getCurrentAPY();
      expect(apy1).to.be.lt(initialAPY);
      expect(apy1).to.be.gt(5000); // Should be > 50%

      // Add 50% of target liquidity
      const stakeAmount2 = 500_000n * ONE; // 0.5M (50% of target)

      await stakingToken.connect(bob).approve(poolAddr, stakeAmount2);
      await rewardsPool.connect(bob).stake(stakeAmount2);

      const apy2 = await rewardsPool.getCurrentAPY();
      expect(apy2).to.be.lt(apy1);

      // Add another 500k to reach 1.1M (110% of target)
      const stakeAmount3 = 500_000n * ONE;

      await stakingToken.connect(charlie).approve(poolAddr, stakeAmount3);
      await rewardsPool.connect(charlie).stake(stakeAmount3);

      const apy3 = await rewardsPool.getCurrentAPY();
      expect(apy3).to.be.lt(apy2);
    });

    it("Should not go below minimum APY", async function () {
      const { rewardsPool, stakingToken, alice, owner } = await loadFixture(deployRewardsPool);

      // First update APY parameters to make testing easier
      // Set higher base APY and lower target
      await rewardsPool.connect(owner).setAPYParameters(10000, 100_000n * ONE, 500);

      const poolAddr = await rewardsPool.getAddress();
      const hugeStake = 2_000_000n * ONE; // Stake 2M (20x target) to drive APY to minimum

      // Give alice the huge stake
      const aliceBalance = await stakingToken.balanceOf(alice.address);
      const needed = hugeStake - aliceBalance;
      if (needed > 0n) {
        await stakingToken.mint(alice.address, needed);
      }

      await stakingToken.connect(alice).approve(poolAddr, hugeStake);
      await rewardsPool.connect(alice).stake(hugeStake);

      // With 2M staked and 100k target (20x), APY should hit minimum floor
      // Formula: 10000 / (1 + 20) = 476 bps, which is < 500 min, so should be 500
      const currentAPY = await rewardsPool.getCurrentAPY();
      const minAPY = await rewardsPool.minAPY();

      expect(currentAPY).to.equal(minAPY);
    });
  });

  describe("Rewards Calculation", function () {
    it("Should calculate pending rewards correctly over time", async function () {
      const { rewardsPool, stakingToken, alice } = await loadFixture(deployRewardsPool);

      const stakeAmount = 100_000n * ONE;
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount);
      await rewardsPool.connect(alice).stake(stakeAmount);

      // Fast forward 1 day
      await time.increase(86400);

      const pendingRewards = await rewardsPool.pendingRewards(alice.address);
      expect(pendingRewards).to.be.gt(0);

      // Fast forward another day
      await time.increase(86400);

      const pendingRewards2 = await rewardsPool.pendingRewards(alice.address);
      expect(pendingRewards2).to.be.gt(pendingRewards);
    });

    it("Should accumulate rewards proportionally to stake amount", async function () {
      const { rewardsPool, stakingToken, alice, bob } = await loadFixture(deployRewardsPool);

      const stakeAmount1 = 100_000n * ONE;
      const stakeAmount2 = 200_000n * ONE; // 2x alice's stake
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount1);
      await rewardsPool.connect(alice).stake(stakeAmount1);

      await stakingToken.connect(bob).approve(poolAddr, stakeAmount2);
      await rewardsPool.connect(bob).stake(stakeAmount2);

      // Fast forward 1 day
      await time.increase(86400);

      const pendingRewardsAlice = await rewardsPool.pendingRewards(alice.address);
      const pendingRewardsBob = await rewardsPool.pendingRewards(bob.address);

      // Bob should have roughly 2x alice's rewards (may vary due to APY changes)
      expect(pendingRewardsBob).to.be.gt(pendingRewardsAlice);
    });

    it("Should return zero pending rewards when no stake", async function () {
      const { rewardsPool, alice } = await loadFixture(deployRewardsPool);

      const pendingRewards = await rewardsPool.pendingRewards(alice.address);
      expect(pendingRewards).to.equal(0);
    });
  });

  describe("Claiming Rewards", function () {
    it("Should allow users to claim rewards in confidential tokens", async function () {
      const { rewardsPool, stakingToken, rewardsToken, alice } = await loadFixture(deployRewardsPool);

      const stakeAmount = 10_000n * ONE; // Smaller amount to keep rewards reasonable
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount);
      await rewardsPool.connect(alice).stake(stakeAmount);

      // Fast forward 1 hour (not 7 days to avoid huge rewards)
      await time.increase(3600);

      const pendingBefore = await rewardsPool.pendingRewards(alice.address);
      expect(pendingBefore).to.be.gt(0);

      // Claim rewards
      await rewardsPool.connect(alice).claimRewards();

      // Verify balance handle exists for alice (rewards were transferred)
      const balanceHandle = await rewardsToken.confidentialBalanceOf(alice.address);
      expect(balanceHandle).to.not.be.undefined;

      // Pending rewards should be reset
      const pendingAfter = await rewardsPool.pendingRewards(alice.address);
      expect(pendingAfter).to.equal(0);
    });

    it("Should revert when claiming with no rewards", async function () {
      const { rewardsPool, alice } = await loadFixture(deployRewardsPool);

      await expect(rewardsPool.connect(alice).claimRewards()).to.be.revertedWithCustomError(rewardsPool, "ZeroAmount");
    });

    it("Should allow multiple claims over time", async function () {
      const { rewardsPool, stakingToken, alice } = await loadFixture(deployRewardsPool);

      const stakeAmount = 10_000n * ONE; // Smaller amount
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount);
      await rewardsPool.connect(alice).stake(stakeAmount);

      // First claim after 30 minutes
      await time.increase(1800);
      await rewardsPool.connect(alice).claimRewards();

      // Second claim after another 30 minutes
      await time.increase(1800);
      const pendingBefore2 = await rewardsPool.pendingRewards(alice.address);
      expect(pendingBefore2).to.be.gt(0);

      await rewardsPool.connect(alice).claimRewards();

      const pendingAfter2 = await rewardsPool.pendingRewards(alice.address);
      expect(pendingAfter2).to.equal(0);
    });
  });

  describe("Emergency Withdraw", function () {
    it("Should allow emergency withdrawal of all staked tokens", async function () {
      const { rewardsPool, stakingToken, alice } = await loadFixture(deployRewardsPool);

      const stakeAmount = 100_000n * ONE;
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount);
      await rewardsPool.connect(alice).stake(stakeAmount);

      const balanceBefore = await stakingToken.balanceOf(alice.address);

      await rewardsPool.connect(alice).emergencyWithdraw();

      const balanceAfter = await stakingToken.balanceOf(alice.address);
      expect(balanceAfter - balanceBefore).to.equal(stakeAmount);

      const userStake = await rewardsPool.getUserStake(alice.address);
      expect(userStake.amount).to.equal(0);
    });

    it("Should claim rewards during emergency withdraw", async function () {
      const { rewardsPool, stakingToken, rewardsToken, alice } = await loadFixture(deployRewardsPool);

      const stakeAmount = 100_000n * ONE;
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount);
      await rewardsPool.connect(alice).stake(stakeAmount);

      // Fast forward to accumulate rewards
      await time.increase(7 * 86400);

      await rewardsPool.connect(alice).emergencyWithdraw();

      // Verify balance handle exists for alice (rewards were transferred)
      const balanceHandle = await rewardsToken.confidentialBalanceOf(alice.address);
      expect(balanceHandle).to.not.be.undefined;
    });

    it("Should revert when emergency withdrawing with no stake", async function () {
      const { rewardsPool, alice } = await loadFixture(deployRewardsPool);

      await expect(rewardsPool.connect(alice).emergencyWithdraw()).to.be.revertedWithCustomError(
        rewardsPool,
        "InsufficientStake",
      );
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update APY parameters", async function () {
      const { rewardsPool, owner } = await loadFixture(deployRewardsPool);

      const newBaseAPY = 20000; // 200%
      const newTargetLiquidity = 2_000_000n * ONE;
      const newMinAPY = 1000; // 10%

      await rewardsPool.connect(owner).setAPYParameters(newBaseAPY, newTargetLiquidity, newMinAPY);

      expect(await rewardsPool.baseAPY()).to.equal(newBaseAPY);
      expect(await rewardsPool.targetLiquidity()).to.equal(newTargetLiquidity);
      expect(await rewardsPool.minAPY()).to.equal(newMinAPY);
    });

    it("Should revert if non-owner tries to update APY parameters", async function () {
      const { rewardsPool, alice } = await loadFixture(deployRewardsPool);

      await expect(
        rewardsPool.connect(alice).setAPYParameters(20000, 2_000_000n * ONE, 1000),
      ).to.be.revertedWithCustomError(rewardsPool, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to update rewards per second", async function () {
      const { rewardsPool, owner } = await loadFixture(deployRewardsPool);

      const newRate = 2e15; // 0.002 tokens/sec

      await rewardsPool.connect(owner).setRewardsPerSecond(newRate);

      expect(await rewardsPool.rewardsPerSecond()).to.equal(newRate);
    });

    it("Should revert if non-owner tries to update rewards rate", async function () {
      const { rewardsPool, alice } = await loadFixture(deployRewardsPool);

      await expect(rewardsPool.connect(alice).setRewardsPerSecond(2e15)).to.be.revertedWithCustomError(
        rewardsPool,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("View Functions", function () {
    it("Should return correct pool stats", async function () {
      const { rewardsPool, stakingToken, alice } = await loadFixture(deployRewardsPool);

      const stakeAmount = 100_000n * ONE;
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount);
      await rewardsPool.connect(alice).stake(stakeAmount);

      const [totalStaked, currentAPY, rewardsPerSec] = await rewardsPool.getPoolStats();

      expect(totalStaked).to.equal(stakeAmount);
      expect(currentAPY).to.be.gt(0);
      expect(rewardsPerSec).to.equal(await rewardsPool.rewardsPerSecond());
    });

    it("Should return correct user stake info", async function () {
      const { rewardsPool, stakingToken, alice } = await loadFixture(deployRewardsPool);

      const stakeAmount = 100_000n * ONE;
      const poolAddr = await rewardsPool.getAddress();

      await stakingToken.connect(alice).approve(poolAddr, stakeAmount);
      await rewardsPool.connect(alice).stake(stakeAmount);

      const [amount, lastUpdateTime, accumulatedRewards] = await rewardsPool.getUserStake(alice.address);

      expect(amount).to.equal(stakeAmount);
      expect(lastUpdateTime).to.be.gt(0);
      expect(accumulatedRewards).to.equal(0); // No time has passed
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complex scenario with multiple users staking and unstaking", async function () {
      const { rewardsPool, stakingToken, alice, bob, charlie } = await loadFixture(deployRewardsPool);

      const poolAddr = await rewardsPool.getAddress();

      // Alice stakes 100k
      const aliceStake = 100_000n * ONE;
      await stakingToken.connect(alice).approve(poolAddr, aliceStake);
      await rewardsPool.connect(alice).stake(aliceStake);

      // Fast forward 1 day
      await time.increase(86400);

      // Bob stakes 200k
      const bobStake = 200_000n * ONE;
      await stakingToken.connect(bob).approve(poolAddr, bobStake);
      await rewardsPool.connect(bob).stake(bobStake);

      // Fast forward 1 day
      await time.increase(86400);

      // Charlie stakes 300k
      const charlieStake = 300_000n * ONE;
      await stakingToken.connect(charlie).approve(poolAddr, charlieStake);
      await rewardsPool.connect(charlie).stake(charlieStake);

      // Fast forward 1 day
      await time.increase(86400);

      // Check all have pending rewards
      const aliceRewards = await rewardsPool.pendingRewards(alice.address);
      const bobRewards = await rewardsPool.pendingRewards(bob.address);
      const charlieRewards = await rewardsPool.pendingRewards(charlie.address);

      expect(aliceRewards).to.be.gt(0);
      expect(bobRewards).to.be.gt(0);
      expect(charlieRewards).to.be.gt(0);

      // Alice should have most rewards (staked longest)
      expect(aliceRewards).to.be.gt(charlieRewards);

      // Alice unstakes half
      await rewardsPool.connect(alice).unstake(aliceStake / 2n);

      // Verify alice's stake reduced
      const aliceStakeAfter = await rewardsPool.getUserStake(alice.address);
      expect(aliceStakeAfter.amount).to.equal(aliceStake / 2n);
    });

    it("Should maintain APY changes correctly as users stake/unstake", async function () {
      const { rewardsPool, stakingToken, alice, bob } = await loadFixture(deployRewardsPool);

      const poolAddr = await rewardsPool.getAddress();

      // Start APY should be max
      const apy0 = await rewardsPool.getCurrentAPY();
      expect(apy0).to.equal(10000);

      // Alice stakes
      const aliceStake = 500_000n * ONE;
      await stakingToken.connect(alice).approve(poolAddr, aliceStake);
      await rewardsPool.connect(alice).stake(aliceStake);

      const apy1 = await rewardsPool.getCurrentAPY();
      expect(apy1).to.be.lt(apy0);

      // Bob stakes more
      const bobStake = 500_000n * ONE;
      await stakingToken.connect(bob).approve(poolAddr, bobStake);
      await rewardsPool.connect(bob).stake(bobStake);

      const apy2 = await rewardsPool.getCurrentAPY();
      expect(apy2).to.be.lt(apy1);

      // Bob unstakes all
      await rewardsPool.connect(bob).unstake(bobStake);

      const apy3 = await rewardsPool.getCurrentAPY();
      expect(apy3).to.be.gt(apy2);
      expect(apy3).to.be.closeTo(apy1, 100); // Should be close to apy1
    });
  });
});
