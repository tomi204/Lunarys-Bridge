import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Seeds the virtual reserves for the PrivacyPool.
 * MUST be called after depositing both token0 and token1 to the pool.
 *
 * Examples:
 *   - npx hardhat --network sepolia task:seed-pool --virtual1 750000
 *   - npx hardhat --network sepolia task:seed-pool --virtual1 500000 --pool 0xPool
 */
task("task:seed-pool", "Initialize virtual reserves for PrivacyPool")
  .addParam("virtual1", "Virtual reserve amount for token1 (uint112)")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV2)")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    // 1) Resolve pool address
    const poolDeployment = args.pool ? { address: args.pool } : await deployments.get("PrivacyPoolV2");

    console.log(`Pool: ${poolDeployment.address}`);
    console.log(`Virtual1: ${args.virtual1}`);

    // 2) Get signer and contract
    const [signer] = await ethers.getSigners();
    const pool = await ethers.getContractAt("PrivacyPoolV2", poolDeployment.address, signer);

    // 3) Check current reserves
    try {
      const [r0Before, r1vBefore] = await pool.getReserves();
      console.log(`📊 Before => token0: ${r0Before.toString()} | token1Virtual: ${r1vBefore.toString()}`);

      if (r1vBefore > 0) {
        console.log("⚠️  Pool already seeded! Virtual reserves are not zero.");
        return;
      }
    } catch (e) {
      console.log("Could not read current reserves, proceeding...");
    }

    // 4) Seed virtual reserves
    console.log(`➡️  Seeding virtual reserves with r1Virtual=${args.virtual1}`);
    const tx = await pool.seedVirtualReserves(args?.virtual1, args?.virtual1);
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gasUsed=${rc?.gasUsed?.toString()}`);

    // 5) Verify final reserves
    try {
      const [r0After, r1vAfter] = await pool.getReserves();
      console.log(`📊 After => token0: ${r0After.toString()} | token1Virtual: ${r1vAfter.toString()}`);

      if (r0After > 0 && r1vAfter > 0) {
        console.log("🎉 Pool successfully initialized! Ready for swaps and liquidity operations.");
      } else {
        console.log("❌ Something went wrong. Reserves are still zero.");
      }
    } catch (e) {
      console.log("Could not verify final reserves:", e);
    }
  });
