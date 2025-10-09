import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const ONE = 10n ** 18n;
const FEE_DENOM = 1_000_000n;

async function deployPoolWithFee999999() {
  return deployPool(999_999);
}

async function deployPoolWithFee1M() {
  return deployPool(1_000_000);
}

async function deployPool(fee: number = 3000) {
  const [owner, alice, bob] = await ethers.getSigners();

  const Token0Factory = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
  const token0 = await Token0Factory.deploy("Mock Token 0", "MT0", 1_000_000n * ONE);
  await token0.waitForDeployment();

  const Token1Factory = await ethers.getContractFactory("CERC20");
  const token1 = await Token1Factory.deploy(owner.address, 1_000_000_000, "Conf Token", "CTKN", "");
  await token1.waitForDeployment();

  const PositionNFTFactory = await ethers.getContractFactory("PositionNFT");
  const positionNFT = await PositionNFTFactory.deploy(owner.address);
  await positionNFT.waitForDeployment();

  const PoolFactory = await ethers.getContractFactory("contracts/PrivacyPool.sol:PrivacyPoolV2");
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

async function seedPool(
  pool: any,
  token0: any,
  token1: any,
  owner: any,
  {
    deposit0 = 1_000n * ONE,
    deposit1 = 500_000,
    virtual1 = 500_000,
  }: { deposit0?: bigint; deposit1?: number; virtual1?: number } = {},
) {
  const poolAddress = await pool.getAddress();

  await token0.connect(owner).transfer(poolAddress, deposit0);

  const encryptedDeposit = await fhevm
    .createEncryptedInput(await token1.getAddress(), owner.address)
    .add64(deposit1)
    .encrypt();

  await token1
    .connect(owner)
    [
      "confidentialTransfer(address,bytes32,bytes)"
    ](poolAddress, encryptedDeposit.handles[0], encryptedDeposit.inputProof);

  await pool.connect(owner).seedVirtualReserves(virtual1);
}

describe("PrivacyPoolV2", () => {
  describe("initialization", () => {
    it("seeds virtual reserves once and exposes state", async () => {
      const { owner, token0, token1, pool } = await loadFixture(deployPool);

      await expect(pool.connect(owner).seedVirtualReserves(1_000)).to.be.revertedWithCustomError(pool, "EmptyReserves");

      await seedPool(pool, token0, token1, owner, { deposit0: 2_000n * ONE, deposit1: 750_000, virtual1: 750_000 });

      const [reserve0, reserve1Virtual] = await pool.getReserves();
      expect(reserve0).to.equal(2_000n * ONE);
      expect(reserve1Virtual).to.equal(750_000);

      await expect(pool.connect(owner).seedVirtualReserves(750_000)).to.be.revertedWithCustomError(
        pool,
        "AlreadySeeded",
      );
    });

    it("rejects zero virtual reserve values", async () => {
      const { owner, token0, token1, pool } = await loadFixture(deployPool);

      await token0.connect(owner).transfer(await pool.getAddress(), 1_000n * ONE);
      await expect(pool.connect(owner).seedVirtualReserves(0)).to.be.revertedWithCustomError(pool, "ZeroAmount");
    });
  });

  describe("token0 -> token1 swaps", () => {
    it("executes swap respecting AMM math and updates analytics", async () => {
      const { owner, alice, token0, token1, pool, fee } = await loadFixture(deployPool);
      await seedPool(pool, token0, token1, owner);

      const poolAddress = await pool.getAddress();
      const [reserve0Before, reserve1Before] = await pool.getReserves();

      await token0.connect(owner).transfer(alice.address, 200n * ONE);
      await token0.connect(alice).approve(poolAddress, ethers.MaxUint256);

      const amountIn = 100n * ONE;
      const deadline = (await time.latest()) + 3600;
      const tx = await pool.connect(alice).swapToken0ForToken1(amountIn, 1, alice.address, deadline);

      await expect(tx).to.emit(pool, "SwapConfidential").withArgs(alice.address, alice.address, true);

      const { volume: volumeEpoch } = await pool.getEpochData();
      expect(volumeEpoch).to.equal(amountIn);

      const [reserve0After, reserve1After] = await pool.getReserves();

      const feeFactor = FEE_DENOM - BigInt(fee);
      const amountInAfterFee = (amountIn * feeFactor) / FEE_DENOM;
      const k = BigInt(reserve0Before) * BigInt(reserve1Before);
      const expectedR0After = BigInt(reserve0Before) + amountInAfterFee;
      const expectedR1After = k / expectedR0After;
      const expectedOut = BigInt(reserve1Before) - expectedR1After;

      expect(reserve0After).to.equal(expectedR0After);
      expect(reserve1After).to.equal(expectedR1After);

      const balanceAfter = await token0.balanceOf(alice.address);
      expect(balanceAfter).to.equal(100n * ONE);
      expect(expectedOut).to.be.greaterThan(0n);
    });

    it("reverts when slippage constraint is not met", async () => {
      const { owner, alice, token0, token1, pool, fee } = await loadFixture(deployPool);
      await seedPool(pool, token0, token1, owner);

      const poolAddress = await pool.getAddress();
      const [reserve0Before, reserve1Before] = await pool.getReserves();

      await token0.connect(owner).transfer(alice.address, 50n * ONE);
      await token0.connect(alice).approve(poolAddress, ethers.MaxUint256);

      const amountIn = 10n * ONE;
      const feeFactor = FEE_DENOM - BigInt(fee);
      const amountInAfterFee = (amountIn * feeFactor) / FEE_DENOM;
      const expectedOut =
        BigInt(reserve1Before) -
        (BigInt(reserve0Before) * BigInt(reserve1Before)) / (BigInt(reserve0Before) + amountInAfterFee);
      const deadline = (await time.latest()) + 3600;

      await expect(
        pool.connect(alice).swapToken0ForToken1(amountIn, expectedOut + 1n, alice.address, deadline),
      ).to.be.revertedWithCustomError(pool, "Slippage");
    });

    it("reverts when amount in after fee collapses to zero", async () => {
      const { owner, alice, token0, token1, pool } = await loadFixture(deployPoolWithFee999999);
      await seedPool(pool, token0, token1, owner, { deposit0: 1_000n * ONE, deposit1: 100_000, virtual1: 100_000 });

      const poolAddress = await pool.getAddress();
      await token0.connect(owner).transfer(alice.address, 1n);
      await token0.connect(alice).approve(poolAddress, ethers.MaxUint256);
      const deadline = (await time.latest()) + 3600;

      await expect(
        pool.connect(alice).swapToken0ForToken1(1, 0, alice.address, deadline),
      ).to.be.revertedWithCustomError(pool, "AmountTooSmall");
    });
  });

  describe("token1 -> token0 swaps", () => {
    async function setupSwapFixture() {
      const fixture = await loadFixture(deployPool);
      await seedPool(fixture.pool, fixture.token0, fixture.token1, fixture.owner, {
        deposit0: 5_000n * ONE,
        deposit1: 2_000_000,
        virtual1: 2_000_000,
      });

      const poolAddress = await fixture.pool.getAddress();

      // Give Alice confidential balance and allow the pool to operate
      const encryptedForAlice = await fhevm
        .createEncryptedInput(await fixture.token1.getAddress(), fixture.owner.address)
        .add64(1_000_000)
        .encrypt();

      await fixture.token1
        .connect(fixture.owner)
        [
          "confidentialTransfer(address,bytes32,bytes)"
        ](fixture.alice.address, encryptedForAlice.handles[0], encryptedForAlice.inputProof);

      const expiry = (await time.latest()) + 3600;
      await fixture.token1.connect(fixture.alice).setOperator(poolAddress, expiry);

      return fixture;
    }

    it("processes exact-out swap and finalizes via callback", async () => {
      const { pool, token0, token1, alice, owner, fee } = await setupSwapFixture();

      const [reserve0Before, reserve1Before] = await pool.getReserves();
      const amountIn = 400_000n;
      const feeFactor = FEE_DENOM - BigInt(fee);
      const amountAfterFee = (amountIn * feeFactor) / FEE_DENOM;
      const k = BigInt(reserve0Before) * BigInt(reserve1Before);
      const expectedR1After = BigInt(reserve1Before) + amountAfterFee;
      const expectedR0After = k / expectedR1After;
      const expectedOut = BigInt(reserve0Before) - expectedR0After;
      const buffer = expectedOut / 20n; // 5% buffer
      const minOut = expectedOut > 0n ? expectedOut - buffer : 0n;

      const encrypted = await fhevm
        .createEncryptedInput(await pool.getAddress(), alice.address)
        .add64(Number(amountIn))
        .encrypt();
      const deadline = (await time.latest()) + 3600;
      const balanceBefore = await token0.balanceOf(alice.address);

      const tx = await pool
        .connect(alice)
        .swapToken1ForToken0ExactOut(encrypted.handles[0], minOut, alice.address, encrypted.inputProof, deadline);
      const receipt = await tx.wait();
      console.log(receipt, tx, "ddkaskldskladskdjaalsjdkladaskdasljdsa");
      expect(receipt).to.not.be.undefined;

      const blockBefore = await ethers.provider.getBlockNumber();
      console.log("block before awaitDecryptionOracle", blockBefore);
      await ethers.provider.send("hardhat_mine", ["0x40"]);
      const blockAfterMine = await ethers.provider.getBlockNumber();
      console.log("block after mine", blockAfterMine);
      await fhevm.awaitDecryptionOracle();

      const balanceAfter = await token0.balanceOf(alice.address);
      const [reserve0After, reserve1After] = await pool.getReserves();
      expect(balanceAfter - balanceBefore).to.equal(expectedOut);
      expect(reserve0After).to.equal(expectedR0After);
      expect(reserve1After).to.equal(expectedR1After);
    });

    it("reverts when minOut is unachievable", async () => {
      const { pool, token0, token1, alice, fee } = await setupSwapFixture();

      const [reserve0Before, reserve1Before] = await pool.getReserves();
      const amountIn = 100_000n;
      const feeFactor = FEE_DENOM - BigInt(fee);
      const amountAfterFee = (amountIn * feeFactor) / FEE_DENOM;
      const k = BigInt(reserve0Before) * BigInt(reserve1Before);
      const expectedR1After = BigInt(reserve1Before) + amountAfterFee;
      const expectedR0After = k / expectedR1After;
      const expectedOut = BigInt(reserve0Before) - expectedR0After;
      const minOut = expectedOut + 1n; // force slippage failure

      const encrypted = await fhevm
        .createEncryptedInput(await pool.getAddress(), alice.address)
        .add64(Number(amountIn))
        .encrypt();

      const deadline = (await time.latest()) + 3600;
      const balanceBefore = await token0.balanceOf(alice.address);

      await pool
        .connect(alice)
        .swapToken1ForToken0ExactOut(encrypted.handles[0], minOut, alice.address, encrypted.inputProof, deadline);

      let caught: unknown;
      try {
        await fhevm.awaitDecryptionOracle();
        expect.fail("decryption oracle should have reverted due to slippage");
      } catch (err) {
        caught = err;
      }

      expect(caught).to.be.instanceOf(Error);
      const balanceAfter = await token0.balanceOf(alice.address);
      const [reserve0After, reserve1After] = await pool.getReserves();
      expect(balanceAfter).to.equal(balanceBefore);
      expect(reserve0After).to.equal(reserve0Before);
      expect(reserve1After).to.equal(reserve1Before);
    });

    it("reverts when decrypted amount is wiped by fees", async () => {
      const { owner, alice, token0, token1, pool } = await loadFixture(deployPoolWithFee1M);
      await seedPool(pool, token0, token1, owner, { deposit0: 2_000n * ONE, deposit1: 500_000, virtual1: 500_000 });

      const poolAddress = await pool.getAddress();
      const encryptedForAlice = await fhevm
        .createEncryptedInput(await token1.getAddress(), owner.address)
        .add64(10_000)
        .encrypt();
      await token1
        .connect(owner)
        [
          "confidentialTransfer(address,bytes32,bytes)"
        ](alice.address, encryptedForAlice.handles[0], encryptedForAlice.inputProof);

      const expiry = (await time.latest()) + 3600;
      await token1.connect(alice).setOperator(poolAddress, expiry);

      const encrypted = await fhevm
        .createEncryptedInput(await pool.getAddress(), alice.address)
        .add64(1)
        .encrypt();
      const deadline = (await time.latest()) + 3600;
      const [reserve0Before, reserve1Before] = await pool.getReserves();
      const balanceBefore = await token0.balanceOf(alice.address);

      expect(
        await pool
          .connect(alice)
          .swapToken1ForToken0ExactOut(encrypted.handles[0], 1, alice.address, encrypted.inputProof, deadline),
      ).to.not.be.reverted;

      let caught: unknown;
      try {
        await fhevm.awaitDecryptionOracle();
        expect.fail("decryption oracle should have reverted due to zero amount after fees");
      } catch (err) {
        caught = err;
      }

      expect(caught).to.be.instanceOf(Error);
      const balanceAfter = await token0.balanceOf(alice.address);
      const [reserve0After, reserve1After] = await pool.getReserves();
      expect(balanceAfter).to.equal(balanceBefore);
      expect(reserve0After).to.equal(reserve0Before);
      expect(reserve1After).to.equal(reserve1Before);
    });
  });

  describe("deadlines", () => {
    it("rejects expired deadlines for both swap paths", async () => {
      const { owner, alice, token0, token1, pool } = await loadFixture(deployPool);
      await seedPool(pool, token0, token1, owner);

      const pastDeadline = (await time.latest()) - 1;
      await token0.connect(owner).transfer(alice.address, 100n * ONE);
      await token0.connect(alice).approve(await pool.getAddress(), ethers.MaxUint256);

      await expect(
        pool.connect(alice).swapToken0ForToken1(1n * ONE, 1, alice.address, pastDeadline),
      ).to.be.revertedWithCustomError(pool, "Expired");

      const encrypted = await fhevm
        .createEncryptedInput(await pool.getAddress(), alice.address)
        .add64(10_000)
        .encrypt();
      await token1.connect(alice).setOperator(await pool.getAddress(), pastDeadline + 1000);

      await expect(
        pool
          .connect(alice)
          .swapToken1ForToken0ExactOut(encrypted.handles[0], 1, alice.address, encrypted.inputProof, pastDeadline),
      ).to.be.revertedWithCustomError(pool, "Expired");
    });
  });

  describe("liquidity management and rewards", () => {
    it("mints and burns liquidity positions via owner", async () => {
      const { owner, pool, positionNFT, token0, token1 } = await loadFixture(deployPool);
      await seedPool(pool, token0, token1, owner);

      const deadline = (await time.latest()) + 3600;
      await token0.connect(owner).approve(await pool.getAddress(), ethers.MaxUint256);
      const tokenIdStatic = await pool
        .connect(owner)
        .provideLiquidityToken0.staticCall(-120, 120, 1_000_000_000_000_000_000n, owner.address, deadline);

      await expect(
        pool.connect(owner).provideLiquidityToken0(-120, 120, 1_000_000_000_000_000_000n, owner.address, deadline),
      ).to.emit(pool, "MintConfidential");

      expect(await positionNFT.balanceOf(owner.address)).to.equal(1n);
      expect(await positionNFT.ownerOf(tokenIdStatic)).to.equal(owner.address);

      const burnDeadline = (await time.latest()) + 3600;
      await expect(pool.connect(owner).burnPosition(tokenIdStatic, burnDeadline)).to.emit(pool, "BurnConfidential");
      expect(await positionNFT.balanceOf(owner.address)).to.equal(0n);
    });

    it("mints confidential liquidity with token1 and can burn it", async () => {
      const { owner, alice, pool, positionNFT, token0, token1 } = await loadFixture(deployPool);
      await seedPool(pool, token0, token1, owner);

      const depositAmount = 250_000;
      const encryptedForAlice = await fhevm
        .createEncryptedInput(await token1.getAddress(), owner.address)
        .add64(depositAmount)
        .encrypt();

      await token1
        .connect(owner)
        [
          "confidentialTransfer(address,bytes32,bytes)"
        ](alice.address, encryptedForAlice.handles[0], encryptedForAlice.inputProof);

      const poolAddress = await pool.getAddress();
      const expiry = (await time.latest()) + 3600;
      await token1.connect(alice).setOperator(poolAddress, expiry);

      const [reserve0Before, reserve1Before] = await pool.getReserves();

      const encryptedDeposit = await fhevm
        .createEncryptedInput(poolAddress, alice.address)
        .add64(depositAmount)
        .encrypt();

      const deadline = (await time.latest()) + 3600;
      const tokenIdStatic = await pool
        .connect(alice)
        .provideLiquidityToken1.staticCall(
          -90,
          90,
          encryptedDeposit.handles[0],
          depositAmount,
          alice.address,
          encryptedDeposit.inputProof,
          deadline,
        );

      const txResp = await pool
        .connect(alice)
        .provideLiquidityToken1(
          -90,
          90,
          encryptedDeposit.handles[0],
          depositAmount,
          alice.address,
          encryptedDeposit.inputProof,
          deadline,
        );
      expect(txResp).to.not.be.undefined;
      const receipt = await txResp.wait();
      expect(receipt?.status).to.equal(1);

      const tokenId = tokenIdStatic;
      expect(await positionNFT.balanceOf(alice.address)).to.equal(1n);
      const userPositions = await positionNFT.getUserPositions(alice.address);
      expect(userPositions.length).to.equal(1);
      expect(userPositions[0]).to.equal(tokenId);
      expect(await positionNFT.ownerOf(tokenId)).to.equal(alice.address);

      const position = await positionNFT.getPosition(tokenId);
      expect(position.isConfidential).to.equal(true);

      const [reserve0After, reserve1After] = await pool.getReserves();
      console.log("reserve0After", reserve0After);
      console.log("reserve1After", reserve1After);
      console.log("reserve0Before", reserve0Before);
      console.log("reserve1Before", reserve1Before);
      console.log("depositAmount", depositAmount);
      console.log("reserve1Before + depositAmount", reserve1Before + BigInt(depositAmount));
      expect(reserve0After).to.equal(reserve0Before);
      expect(reserve1After).to.equal(reserve1Before + BigInt(depositAmount));

      const burnDeadline = (await time.latest()) + 3600;
      await expect(pool.connect(alice).burnPosition(tokenId, burnDeadline)).to.emit(pool, "BurnConfidential");

      const [reserve0Final, reserve1Final] = await pool.getReserves();
      console.log("reserve0Final", reserve0Final);
      console.log("reserve1Final", reserve1Final);
      expect(reserve0Final).to.equal(reserve0Before);
      expect(reserve1Final).to.equal(reserve1Before);
      expect(await positionNFT.balanceOf(alice.address)).to.equal(0n);
    });

    it("accrues and pays rewards proportionally to liquidity", async () => {
      const { owner, pool, positionNFT, token0, token1 } = await loadFixture(deployPool);
      await seedPool(pool, token0, token1, owner, {
        deposit0: 10_000n * ONE,
        deposit1: 1_000_000,
        virtual1: 1_000_000,
      });

      const deadline = (await time.latest()) + 3600;
      await token0.connect(owner).approve(await pool.getAddress(), ethers.MaxUint256);
      const tx = await pool
        .connect(owner)
        .provideLiquidityToken0(-60, 60, 1_000_000_000_000_000_000n, owner.address, deadline);
      await tx.wait();

      const poolBalance = await token0.balanceOf(await pool.getAddress());
      expect(poolBalance).to.be.greaterThan(0n);

      const balanceBefore = await token0.balanceOf(owner.address);
      await time.increase(3600);

      const claimTx = await pool.connect(owner).claimRewards();
      await expect(claimTx).to.emit(pool, "RewardsClaimed").withArgs(owner.address);
      const balanceAfter = await token0.balanceOf(owner.address);
      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });
  });
});
