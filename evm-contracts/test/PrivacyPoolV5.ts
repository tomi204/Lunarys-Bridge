import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const ONE = 10n ** 18n;
const FEE_DENOM = 1_000_000n;

async function deployPoolV5(fee: number = 3000) {
  const [owner, alice, bob] = await ethers.getSigners();

  // Deploy public token0
  const Token0Factory = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
  const token0 = await Token0Factory.deploy("Public Token0", "PTK0", 1_000_000n * ONE);
  await token0.waitForDeployment();

  // Deploy public token1
  const Token1Factory = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
  const token1 = await Token1Factory.deploy("Public Token1", "PTK1", 1_000_000n * ONE);
  await token1.waitForDeployment();

  // Deploy PositionNFT
  const PositionNFTFactory = await ethers.getContractFactory("PositionNFT");
  const positionNFT = await PositionNFTFactory.deploy(owner.address);
  await positionNFT.waitForDeployment();

  // Deploy PrivacyPoolV5
  const PoolFactory = await ethers.getContractFactory("PrivacyPoolV5");
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

async function seedPoolV5(pool: any, token0: any, token1: any, deposit0: bigint, deposit1: bigint) {
  const poolAddr = await pool.getAddress();

  // Transfer both tokens (public)
  await token0.transfer(poolAddr, deposit0);
  await token1.transfer(poolAddr, deposit1);

  // Seed reserves
  await pool.seedReserves();

  return { deposit0, deposit1 };
}

describe("PrivacyPoolV5 - Public with Private Amounts", function () {
  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      const { pool, token0, token1, fee } = await loadFixture(deployPoolV5);

      expect(await pool.token0()).to.equal(await token0.getAddress());
      expect(await pool.token1()).to.equal(await token1.getAddress());
      expect(await pool.fee()).to.equal(fee);
    });

    it("Should have zero reserves initially", async function () {
      const { pool } = await loadFixture(deployPoolV5);
      const [r0, r1] = await pool.getReserves();
      expect(r0).to.equal(0);
      expect(r1).to.equal(0);
    });
  });

  describe("Seeding", function () {
    it("Should seed reserves correctly", async function () {
      const { pool, token0, token1 } = await loadFixture(deployPoolV5);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;

      await seedPoolV5(pool, token0, token1, deposit0, deposit1);

      const [r0, r1] = await pool.getReserves();
      expect(r0).to.equal(deposit0);
      expect(r1).to.equal(deposit1);
    });

    it("Should revert if already seeded", async function () {
      const { pool, token0, token1 } = await loadFixture(deployPoolV5);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;

      await seedPoolV5(pool, token0, token1, deposit0, deposit1);

      await expect(pool.seedReserves()).to.be.revertedWithCustomError(pool, "AlreadySeeded");
    });
  });

  describe("Public Swaps", function () {
    it("Should swap token0 for token1 (public)", async function () {
      const { pool, token0, token1, owner, alice } = await loadFixture(deployPoolV5);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV5(pool, token0, token1, deposit0, deposit1);

      // Transfer some token0 to alice
      await token0.transfer(alice.address, 100_000n);

      const amountIn = 10_000n;
      const deadline = BigInt(await time.latest()) + 3600n;

      const poolAddr = await pool.getAddress();
      await token0.connect(alice).approve(poolAddr, amountIn);

      const tx = await pool.connect(alice).swapExactTokensForTokens(amountIn, 0n, true, alice.address, deadline);
      await tx.wait();

      // Verify reserves updated
      const [r0After, r1After] = await pool.getReserves();
      expect(r0After).to.be.gt(deposit0);
      expect(r1After).to.be.lt(deposit1);
    });

    it("Should swap token1 for token0 (public)", async function () {
      const { pool, token0, token1, owner, alice } = await loadFixture(deployPoolV5);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV5(pool, token0, token1, deposit0, deposit1);

      // Transfer some token1 to alice
      await token1.transfer(alice.address, 100_000n);

      const amountIn = 10_000n;
      const deadline = BigInt(await time.latest()) + 3600n;

      const poolAddr = await pool.getAddress();
      await token1.connect(alice).approve(poolAddr, amountIn);

      const tx = await pool.connect(alice).swapExactTokensForTokens(amountIn, 0n, false, alice.address, deadline);
      await tx.wait();

      // Verify reserves updated
      const [r0After, r1After] = await pool.getReserves();
      expect(r0After).to.be.lt(deposit0);
      expect(r1After).to.be.gt(deposit1);
    });

    it("Should calculate correct output amount", async function () {
      const { pool, token0, token1, owner, alice, fee } = await loadFixture(deployPoolV5);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV5(pool, token0, token1, deposit0, deposit1);

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

      const balanceBefore = await token1.balanceOf(alice.address);

      await pool.connect(alice).swapExactTokensForTokens(amountIn, 0n, true, alice.address, deadline);

      const balanceAfter = await token1.balanceOf(alice.address);
      const actualOut = balanceAfter - balanceBefore;

      expect(actualOut).to.equal(expectedOut);
    });

    it("Should revert on slippage", async function () {
      const { pool, token0, token1, owner, alice } = await loadFixture(deployPoolV5);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV5(pool, token0, token1, deposit0, deposit1);

      await token0.transfer(alice.address, 100_000n);

      const amountIn = 10_000n;
      const deadline = BigInt(await time.latest()) + 3600n;

      const poolAddr = await pool.getAddress();
      await token0.connect(alice).approve(poolAddr, amountIn);

      await expect(
        pool.connect(alice).swapExactTokensForTokens(amountIn, 1_000_000n, true, alice.address, deadline),
      ).to.be.revertedWithCustomError(pool, "Slippage");
    });
  });

  describe("Private Swaps (Encrypted Amounts)", function () {
    it("Should initiate private swap", async function () {
      const { pool, token0, token1, owner } = await loadFixture(deployPoolV5);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV5(pool, token0, token1, deposit0, deposit1);

      const poolAddr = await pool.getAddress();

      const amountIn = 10_000;
      const minOut = 0;
      const deadline = BigInt(await time.latest()) + 3600n;

      // Encrypt amount
      const encAmount = await fhevm.createEncryptedInput(poolAddr, owner.address).add64(amountIn).encrypt();

      const encMinOut = await fhevm.createEncryptedInput(poolAddr, owner.address).add64(minOut).encrypt();

      // Initiate private swap (returns requestId)
      const tx = await pool.initiatePrivateSwap(
        encAmount.handles[0],
        encMinOut.handles[0],
        true,
        owner.address,
        encAmount.inputProof,
        encMinOut.inputProof,
        deadline,
      );

      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      // Note: Finalization would require async decryption callback
    });
  });

  describe("Liquidity Management", function () {
    it("Should add liquidity", async function () {
      const { pool, token0, token1, owner, alice } = await loadFixture(deployPoolV5);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV5(pool, token0, token1, deposit0, deposit1);

      await token0.transfer(alice.address, 100_000n);
      await token1.transfer(alice.address, 100_000n);

      const amount0 = 50_000n;
      const amount1 = 37_500n;
      const deadline = BigInt(await time.latest()) + 3600n;

      const poolAddr = await pool.getAddress();
      await token0.connect(alice).approve(poolAddr, amount0);
      await token1.connect(alice).approve(poolAddr, amount1);

      const tx = await pool.connect(alice).addLiquidity(-120, 120, amount0, amount1, alice.address, deadline);
      const receipt = await tx.wait();

      // Check reserves updated
      const [r0After, r1After] = await pool.getReserves();
      expect(r0After).to.equal(deposit0 + amount0);
      expect(r1After).to.equal(deposit1 + amount1);
    });

    it("Should remove liquidity", async function () {
      const { pool, token0, token1, owner, alice } = await loadFixture(deployPoolV5);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV5(pool, token0, token1, deposit0, deposit1);

      await token0.transfer(alice.address, 100_000n);
      await token1.transfer(alice.address, 100_000n);

      const amount0 = 50_000n;
      const amount1 = 37_500n;
      let deadline = BigInt(await time.latest()) + 3600n;

      const poolAddr = await pool.getAddress();
      await token0.connect(alice).approve(poolAddr, amount0);
      await token1.connect(alice).approve(poolAddr, amount1);

      await pool.connect(alice).addLiquidity(-120, 120, amount0, amount1, alice.address, deadline);

      const tokenId = 1n; // First position

      const balance0Before = await token0.balanceOf(alice.address);
      const balance1Before = await token1.balanceOf(alice.address);

      // Remove liquidity - get new deadline
      deadline = BigInt(await time.latest()) + 3600n;
      await pool.connect(alice).removeLiquidity(tokenId, deadline);

      const balance0After = await token0.balanceOf(alice.address);
      const balance1After = await token1.balanceOf(alice.address);

      expect(balance0After).to.be.gt(balance0Before);
      expect(balance1After).to.be.gt(balance1Before);
    });
  });

  describe("View Functions", function () {
    it("Should return correct domain separator", async function () {
      const { pool } = await loadFixture(deployPoolV5);
      const domainSep = await pool.getDomainSeparator();
      expect(domainSep).to.not.equal(ethers.ZeroHash);
    });

    it("Should return reserves", async function () {
      const { pool, token0, token1 } = await loadFixture(deployPoolV5);

      const deposit0 = 1_000_000n;
      const deposit1 = 750_000n;
      await seedPoolV5(pool, token0, token1, deposit0, deposit1);

      const [r0, r1, timestamp] = await pool.getReserves();
      expect(r0).to.equal(deposit0);
      expect(r1).to.equal(deposit1);
      expect(timestamp).to.be.gt(0);
    });

    it("Should return epoch data", async function () {
      const { pool } = await loadFixture(deployPoolV5);
      const [volume, start] = await pool.getEpochData();
      expect(start).to.be.gt(0);
    });
  });
});
