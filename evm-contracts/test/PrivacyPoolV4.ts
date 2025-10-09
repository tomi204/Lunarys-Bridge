import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

async function deployPoolV4(fixedFee: number = 100) {
  const [owner, alice, bob] = await ethers.getSigners();

  // Deploy confidential token0
  const Token0Factory = await ethers.getContractFactory("CERC20");
  const token0 = await Token0Factory.deploy(owner.address, 1_000_000_000, "Conf Token0", "CTKN0", "");
  await token0.waitForDeployment();

  // Deploy confidential token1
  const Token1Factory = await ethers.getContractFactory("CERC20");
  const token1 = await Token1Factory.deploy(owner.address, 1_000_000_000, "Conf Token1", "CTKN1", "");
  await token1.waitForDeployment();

  // Deploy reward token
  const RewardFactory = await ethers.getContractFactory("CERC20");
  const rewardToken = await RewardFactory.deploy(owner.address, 1_000_000_000, "Reward Token", "REWARD", "");
  await rewardToken.waitForDeployment();

  // Deploy PositionNFT
  const PositionNFTFactory = await ethers.getContractFactory("PositionNFT");
  const positionNFT = await PositionNFTFactory.deploy(owner.address);
  await positionNFT.waitForDeployment();

  // Deploy PrivacyPoolV4
  const PoolFactory = await ethers.getContractFactory("PrivacyPoolV4");
  const pool = await PoolFactory.deploy(
    await token0.getAddress(),
    await token1.getAddress(),
    await rewardToken.getAddress(),
    fixedFee,
    60,
    await positionNFT.getAddress(),
    owner.address,
  );
  await pool.waitForDeployment();

  await positionNFT.setPoolManager(await pool.getAddress());

  return { owner, alice, bob, token0, token1, rewardToken, positionNFT, pool, fixedFee };
}

async function seedPoolV4(
  pool: any,
  token0: any,
  token1: any,
  rewardToken: any,
  owner: any,
  deposit0: bigint,
  deposit1: bigint,
) {
  const poolAddr = await pool.getAddress();
  const token0Addr = await token0.getAddress();
  const token1Addr = await token1.getAddress();
  const rewardAddr = await rewardToken.getAddress();

  // Transfer token0 (confidential)
  const enc0 = await fhevm.createEncryptedInput(token0Addr, owner.address).add64(Number(deposit0)).encrypt();

  await token0["confidentialTransfer(address,bytes32,bytes)"](poolAddr, enc0.handles[0], enc0.inputProof);

  // Transfer token1 (confidential)
  const enc1 = await fhevm.createEncryptedInput(token1Addr, owner.address).add64(Number(deposit1)).encrypt();

  await token1["confidentialTransfer(address,bytes32,bytes)"](poolAddr, enc1.handles[0], enc1.inputProof);

  // Transfer rewards
  const encReward = await fhevm.createEncryptedInput(rewardAddr, owner.address).add64(10_000_000).encrypt();

  await rewardToken["confidentialTransfer(address,bytes32,bytes)"](poolAddr, encReward.handles[0], encReward.inputProof);

  // Seed virtual reserves
  await pool.seedVirtualReserves(deposit0, deposit1);

  return { deposit0, deposit1 };
}

describe("PrivacyPoolV4 - Fully Confidential", function () {
  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      const { pool, token0, token1, rewardToken, fixedFee } = await loadFixture(deployPoolV4);

      expect(await pool.token0()).to.equal(await token0.getAddress());
      expect(await pool.token1()).to.equal(await token1.getAddress());
      expect(await pool.rewardToken()).to.equal(await rewardToken.getAddress());
      expect(await pool.fixedFee()).to.equal(fixedFee);
    });

    it("Should have zero reserves initially", async function () {
      const { pool } = await loadFixture(deployPoolV4);
      const [r0v, r1v] = await pool.getReserves();
      expect(r0v).to.equal(0);
      expect(r1v).to.equal(0);
    });
  });

  describe("Seeding", function () {
    it("Should seed virtual reserves correctly", async function () {
      const { pool, token0, token1, rewardToken, owner } = await loadFixture(deployPoolV4);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;

      await seedPoolV4(pool, token0, token1, rewardToken, owner, deposit0, deposit1);

      const [r0v, r1v] = await pool.getReserves();
      expect(r0v).to.equal(deposit0);
      expect(r1v).to.equal(deposit1);
    });

    it("Should revert if already seeded", async function () {
      const { pool, token0, token1, rewardToken, owner } = await loadFixture(deployPoolV4);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;

      await seedPoolV4(pool, token0, token1, rewardToken, owner, deposit0, deposit1);

      await expect(pool.seedVirtualReserves(100_000n, 100_000n)).to.be.revertedWithCustomError(pool, "AlreadySeeded");
    });

    it("Should revert if zero amounts", async function () {
      const { pool } = await loadFixture(deployPoolV4);

      await expect(pool.seedVirtualReserves(0, 100_000n)).to.be.revertedWithCustomError(pool, "ZeroAmount");
      await expect(pool.seedVirtualReserves(100_000n, 0)).to.be.revertedWithCustomError(pool, "ZeroAmount");
    });
  });

  describe("Confidential Swaps", function () {
    it("Should initiate confidential swap", async function () {
      const { pool, token0, token1, rewardToken, owner } = await loadFixture(deployPoolV4);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV4(pool, token0, token1, rewardToken, owner, deposit0, deposit1);

      const poolAddr = await pool.getAddress();

      // Prepare encrypted parameters
      const amountIn = 10_000;
      const minOut = 0;
      const zeroForOne = true;

      const encAmount = await fhevm.createEncryptedInput(poolAddr, owner.address).add64(amountIn).encrypt();

      const encMinOut = await fhevm.createEncryptedInput(poolAddr, owner.address).add64(minOut).encrypt();

      const encDirection = await fhevm.createEncryptedInput(poolAddr, owner.address).addBool(zeroForOne).encrypt();

      const encRecipient = await fhevm.createEncryptedInput(poolAddr, owner.address).addAddress(owner.address).encrypt();

      const deadline = BigInt(await time.latest()) + 3600n;

      // Set operator for both tokens (since we don't know which one will be input)
      await token0.setOperator(poolAddr, deadline);
      await token1.setOperator(poolAddr, deadline);

      // Initiate swap (returns requestId)
      const tx = await pool.initiateConfidentialSwap(
        encAmount.handles[0],
        encMinOut.handles[0],
        encDirection.handles[0],
        encRecipient.handles[0],
        encAmount.inputProof,
        encMinOut.inputProof,
        encDirection.inputProof,
        encRecipient.inputProof,
        deadline,
      );

      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      // Note: Finalization would require async decryption callback
    });
  });

  describe("Confidential Liquidity", function () {
    it("Should provide liquidity with token0", async function () {
      const { pool, token0, token1, rewardToken, owner } = await loadFixture(deployPoolV4);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV4(pool, token0, token1, rewardToken, owner, deposit0, deposit1);

      const poolAddr = await pool.getAddress();
      const token0Addr = await token0.getAddress();

      const amount0 = 50_000;
      const deadline = BigInt(await time.latest()) + 3600n;

      // Set operator
      await token0.setOperator(poolAddr, deadline);

      // Encrypt amount
      const enc = await fhevm.createEncryptedInput(poolAddr, owner.address).add64(amount0).encrypt();

      // Provide liquidity (returns requestId)
      const tx = await pool.provideLiquidityToken0(-120, 120, enc.handles[0], amount0, owner.address, enc.inputProof, deadline);

      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      // Note: Finalization would require async decryption callback
    });

    it("Should provide liquidity with token1", async function () {
      const { pool, token0, token1, rewardToken, owner } = await loadFixture(deployPoolV4);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV4(pool, token0, token1, rewardToken, owner, deposit0, deposit1);

      const poolAddr = await pool.getAddress();
      const token1Addr = await token1.getAddress();

      const amount1 = 50_000;
      const deadline = BigInt(await time.latest()) + 3600n;

      // Set operator
      await token1.setOperator(poolAddr, deadline);

      // Encrypt amount
      const enc = await fhevm.createEncryptedInput(poolAddr, owner.address).add64(amount1).encrypt();

      // Provide liquidity (returns requestId)
      const tx = await pool.provideLiquidityToken1(-90, 90, enc.handles[0], amount1, owner.address, enc.inputProof, deadline);

      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      // Note: Finalization would require async decryption callback
    });
  });

  describe("View Functions", function () {
    it("Should return correct domain separator", async function () {
      const { pool } = await loadFixture(deployPoolV4);
      const domainSep = await pool.getDomainSeparator();
      expect(domainSep).to.not.equal(ethers.ZeroHash);
    });

    it("Should return epoch data", async function () {
      const { pool } = await loadFixture(deployPoolV4);
      const [volume, start] = await pool.getEpochData();
      expect(start).to.be.gt(0);
    });
  });
});
