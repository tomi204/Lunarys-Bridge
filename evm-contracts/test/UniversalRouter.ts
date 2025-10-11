import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const ONE = 10n ** 18n;

async function deployRouter() {
  const [owner, alice] = await ethers.getSigners();

  // Deploy RouterFactory
  const RouterFactory = await ethers.getContractFactory("UniversalRouter");
  const router = await RouterFactory.deploy();
  await router.waitForDeployment();

  return { owner, alice, router };
}

async function deployPoolV5() {
  const [owner] = await ethers.getSigners();

  const Token0Factory = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
  const token0 = await Token0Factory.deploy("Token0", "TK0", 1_000_000n * ONE);
  await token0.waitForDeployment();

  const Token1Factory = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
  const token1 = await Token1Factory.deploy("Token1", "TK1", 1_000_000n * ONE);
  await token1.waitForDeployment();

  const PositionNFTFactory = await ethers.getContractFactory("PositionNFT");
  const positionNFT = await PositionNFTFactory.deploy(owner.address);
  await positionNFT.waitForDeployment();

  const PoolFactory = await ethers.getContractFactory("PrivacyPoolV5");
  const pool = await PoolFactory.deploy(
    await token0.getAddress(),
    await token1.getAddress(),
    3000,
    60,
    await positionNFT.getAddress(),
    owner.address,
  );
  await pool.waitForDeployment();

  return { token0, token1, pool };
}

describe("UniversalRouter", function () {
  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { router } = await loadFixture(deployRouter);
      expect(await router.getAddress()).to.be.properAddress;
    });
  });

  describe("Pool Registration", function () {
    it("Should register V5 pool", async function () {
      const { router } = await loadFixture(deployRouter);
      const { pool, token0, token1 } = await deployPoolV5();

      const poolAddr = await pool.getAddress();
      const token0Addr = await token0.getAddress();
      const token1Addr = await token1.getAddress();

      await router.registerPoolV5(poolAddr);

      const poolInfo = await router.getPool(token0Addr, token1Addr);
      expect(poolInfo.poolAddress).to.equal(poolAddr);
      expect(poolInfo.poolType).to.equal(0); // V5_PUBLIC = 0 (only enum value)
      expect(poolInfo.active).to.be.true;
    });

    it("Should list all registered pools", async function () {
      const { router } = await loadFixture(deployRouter);
      const { pool } = await deployPoolV5();

      await router.registerPoolV5(await pool.getAddress());

      const pools = await router.getAllPools();
      expect(pools.length).to.equal(1);
      expect(pools[0].poolAddress).to.equal(await pool.getAddress());
    });

    it("Should deactivate pool", async function () {
      const { router } = await loadFixture(deployRouter);
      const { pool, token0, token1 } = await deployPoolV5();

      await router.registerPoolV5(await pool.getAddress());

      const token0Addr = await token0.getAddress();
      const token1Addr = await token1.getAddress();

      // Deactivate pool
      await router.deactivatePool(token0Addr, token1Addr);

      // Should revert when trying to get inactive pool
      await expect(router.getPool(token0Addr, token1Addr)).to.be.revertedWithCustomError(router, "PoolInactive");
    });
  });

  describe("Swap via Router", function () {
    it("Should swap via V5 public", async function () {
      const { router, owner } = await loadFixture(deployRouter);
      const { pool, token0, token1 } = await deployPoolV5();

      const poolAddr = await pool.getAddress();
      const routerAddr = await router.getAddress();
      const token0Addr = await token0.getAddress();
      const token1Addr = await token1.getAddress();

      // Register pool
      await router.registerPoolV5(poolAddr);

      // Seed pool
      await token0.transfer(poolAddr, 1_000_000n);
      await token1.transfer(poolAddr, 750_000n);
      await pool.seedReserves();

      // Swap via router
      const amountIn = 10_000n;
      await token0.approve(routerAddr, amountIn);

      const deadline = BigInt(await time.latest()) + 3600n;

      const balanceBefore = await token1.balanceOf(owner.address);

      await router.swapV5Public(token0Addr, token1Addr, amountIn, 0n, true, deadline);

      const balanceAfter = await token1.balanceOf(owner.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });
});
