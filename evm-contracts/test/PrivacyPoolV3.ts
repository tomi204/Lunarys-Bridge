import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const ONE = 10n ** 18n;
const FEE_DENOM = 1_000_000n;

async function deployPoolV3(fee: number = 3000) {
  const [owner, alice, bob] = await ethers.getSigners();

  // Deploy public token0
  const Token0Factory = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
  const token0 = await Token0Factory.deploy("Public Token 0", "PTK0", 1_000_000n * ONE);
  await token0.waitForDeployment();

  // Deploy confidential token1
  const Token1Factory = await ethers.getContractFactory("CERC20");
  const token1 = await Token1Factory.deploy(owner.address, 1_000_000_000, "Conf Token", "CTKN", "");
  await token1.waitForDeployment();

  // Deploy PositionNFT
  const PositionNFTFactory = await ethers.getContractFactory("PositionNFT");
  const positionNFT = await PositionNFTFactory.deploy(owner.address);
  await positionNFT.waitForDeployment();

  // Deploy PrivacyPoolV3
  const PoolFactory = await ethers.getContractFactory("PrivacyPoolV3");
  const pool = await PoolFactory.deploy(
    await token0.getAddress(),
    await token1.getAddress(),
    fee,
    60,
    await positionNFT.getAddress(),
    owner.address,
  );
  await pool.waitForDeployment();

  await positionNFT.setPoolManager(await pool.getAddress());

  return { owner, alice, bob, token0, token1, positionNFT, pool, fee };
}

async function seedPoolV3(pool: any, token0: any, token1: any, owner: any, deposit0: bigint, deposit1: bigint) {
  const poolAddr = await pool.getAddress();
  const token1Addr = await token1.getAddress();

  // Transfer token0 (public)
  await token0.transfer(poolAddr, deposit0);

  // Transfer token1 (confidential)
  const enc = await fhevm.createEncryptedInput(token1Addr, owner.address).add64(Number(deposit1)).encrypt();

  await token1["confidentialTransfer(address,bytes32,bytes)"](poolAddr, enc.handles[0], enc.inputProof);

  // Seed virtual reserves
  await pool.seedVirtualReserves(deposit1);

  return { deposit0, deposit1 };
}

describe("PrivacyPoolV3 - Hybrid (Public + Confidential)", function () {
  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      const { pool, token0, token1, fee } = await loadFixture(deployPoolV3);

      expect(await pool.token0()).to.equal(await token0.getAddress());
      expect(await pool.token1()).to.equal(await token1.getAddress());
      expect(await pool.fee()).to.equal(fee);
    });

    it("Should have zero reserves initially", async function () {
      const { pool } = await loadFixture(deployPoolV3);
      const [r0, r1v] = await pool.getReserves();
      expect(r0).to.equal(0);
      expect(r1v).to.equal(0);
    });
  });

  describe("Seeding", function () {
    it("Should seed virtual reserves correctly", async function () {
      const { pool, token0, token1, owner } = await loadFixture(deployPoolV3);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;

      await seedPoolV3(pool, token0, token1, owner, deposit0, deposit1);

      const [r0, r1v] = await pool.getReserves();
      expect(r0).to.equal(deposit0);
      expect(r1v).to.equal(deposit1);
    });

    it("Should revert if already seeded", async function () {
      const { pool, token0, token1, owner } = await loadFixture(deployPoolV3);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;

      await seedPoolV3(pool, token0, token1, owner, deposit0, deposit1);

      await expect(pool.seedVirtualReserves(100_000n)).to.be.revertedWithCustomError(pool, "AlreadySeeded");
    });
  });

  describe("Swaps - Token0 for Token1", function () {
    it("Should swap token0 for token1", async function () {
      const { pool, token0, token1, owner, alice } = await loadFixture(deployPoolV3);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV3(pool, token0, token1, owner, deposit0, deposit1);

      // Transfer some token0 to alice
      await token0.transfer(alice.address, 100_000n);

      // Alice swaps 10_000 token0 for token1
      const amountIn = 10_000n;
      const deadline = BigInt(await time.latest()) + 3600n;

      const poolAddr = await pool.getAddress();
      await token0.connect(alice).approve(poolAddr, amountIn);

      const tx = await pool.connect(alice).swapToken0ForToken1(amountIn, 0n, alice.address, deadline);
      await tx.wait();

      // Verify reserves updated
      const [r0After, r1vAfter] = await pool.getReserves();
      expect(r0After).to.be.gt(deposit0);
      expect(r1vAfter).to.be.lt(deposit1);
    });

    it("Should calculate correct output amount", async function () {
      const { pool, token0, token1, owner, alice, fee } = await loadFixture(deployPoolV3);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV3(pool, token0, token1, owner, deposit0, deposit1);

      await token0.transfer(alice.address, 100_000n);

      const amountIn = 10_000n;
      const amountInAfterFee = (amountIn * (FEE_DENOM - BigInt(fee))) / FEE_DENOM;

      // Expected: out = r1 - k/(r0+in)
      const k = deposit0 * deposit1;
      const r0After = deposit0 + amountInAfterFee;
      const r1After = k / r0After;
      const expectedOut = deposit1 - r1After;

      const deadline = BigInt(await time.latest()) + 3600n;
      const poolAddr = await pool.getAddress();

      await token0.connect(alice).approve(poolAddr, amountIn);
      await pool.connect(alice).swapToken0ForToken1(amountIn, expectedOut, alice.address, deadline);

      const [, r1vAfter] = await pool.getReserves();
      expect(r1vAfter).to.equal(r1After);
    });

    it("Should revert on slippage", async function () {
      const { pool, token0, token1, owner, alice } = await loadFixture(deployPoolV3);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV3(pool, token0, token1, owner, deposit0, deposit1);

      await token0.transfer(alice.address, 100_000n);

      const amountIn = 10_000n;
      const deadline = BigInt(await time.latest()) + 3600n;

      const poolAddr = await pool.getAddress();
      await token0.connect(alice).approve(poolAddr, amountIn);

      await expect(
        pool.connect(alice).swapToken0ForToken1(amountIn, 1_000_000n, alice.address, deadline),
      ).to.be.revertedWithCustomError(pool, "Slippage");
    });
  });

  describe("Liquidity - Token0 (Public)", function () {
    it("Should provide liquidity with token0", async function () {
      const { pool, token0, token1, owner, alice } = await loadFixture(deployPoolV3);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV3(pool, token0, token1, owner, deposit0, deposit1);

      await token0.transfer(alice.address, 100_000n);

      const amount0 = 50_000n;
      const deadline = BigInt(await time.latest()) + 3600n;

      const poolAddr = await pool.getAddress();
      await token0.connect(alice).approve(poolAddr, amount0);

      const tx = await pool.connect(alice).provideLiquidityToken0(-120, 120, amount0, alice.address, deadline);
      const receipt = await tx.wait();

      // Check reserves updated
      const [r0After] = await pool.getReserves();
      expect(r0After).to.equal(deposit0 + amount0);
    });
  });

  describe("Burn Position", function () {
    it("Should burn position and return tokens", async function () {
      const { pool, token0, token1, owner, alice } = await loadFixture(deployPoolV3);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV3(pool, token0, token1, owner, deposit0, deposit1);

      await token0.transfer(alice.address, 100_000n);

      const amount0 = 50_000n;
      let deadline = BigInt(await time.latest()) + 3600n;

      const poolAddr = await pool.getAddress();
      await token0.connect(alice).approve(poolAddr, amount0);

      const tx = await pool.connect(alice).provideLiquidityToken0(-120, 120, amount0, alice.address, deadline);
      const receipt = await tx.wait();

      // Get tokenId from event (assuming it's emitted)
      const tokenId = 1n; // First position

      const balanceBefore = await token0.balanceOf(alice.address);

      // Burn position - get new deadline
      deadline = BigInt(await time.latest()) + 3600n;
      await pool.connect(alice).burnPosition(tokenId, deadline);

      const balanceAfter = await token0.balanceOf(alice.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });
});
