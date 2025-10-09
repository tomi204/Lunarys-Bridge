import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Sets operator permission for confidential token (CERC20) to allow pool operations.
 * This MUST be called by each user before they can use confidential token swaps or liquidity.
 *
 * Examples:
 *   - npx hardhat --network sepolia task:set-operator --pool 0xPoolAddress
 *   - npx hardhat --network sepolia task:set-operator --pool 0xPoolAddress --hours 24
 *   - npx hardhat --network sepolia task:set-operator --token1 0xCERC20 --pool 0xPool --hours 12
 */
task("task:set-operator", "Authorize pool to operate confidential tokens on behalf of user")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV2)")
  .addOptionalParam("token1", "CERC20 address (default: deployments/CERC20)")
  .addOptionalParam("hours", "Hours until expiry (default: 24)", "24")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    // 1) Resolve addresses
    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV2")).address;
    const token1Addr = args.token1 ?? (await deployments.get("CERC20")).address;

    console.log(`Pool: ${poolAddr}`);
    console.log(`Token1 (CERC20): ${token1Addr}`);
    console.log(`Hours: ${args.hours}`);

    // 2) Get signer and contract
    const [signer] = await ethers.getSigners();
    const cerc20 = await ethers.getContractAt("CERC20", token1Addr, signer);

    // 3) Calculate expiry timestamp
    const hoursInSeconds = Number(args.hours) * 3600;
    const expiry = Math.floor(Date.now() / 1000) + hoursInSeconds;
    const expiryDate = new Date(expiry * 1000);

    console.log(`User: ${signer.address}`);
    console.log(`Expiry: ${expiry} (${expiryDate.toISOString()})`);

    // 4) Set operator
    console.log(`➡️  Setting operator permission for pool...`);
    const tx = await cerc20.setOperator(poolAddr, expiry);
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gasUsed=${rc?.gasUsed?.toString()}`);

    console.log(`🎉 Pool is now authorized to operate confidential tokens for ${signer.address}`);
    console.log(`⚠️  Authorization expires at: ${expiryDate.toISOString()}`);
    console.log(`💡 You can now use swaps and liquidity functions with confidential tokens!`);
  });
