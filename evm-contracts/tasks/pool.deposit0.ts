import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Deposits token0 (ERC20 standard) into the pool.
 *
 * examples:
 *   - npx hardhat --network sepolia task:deposit0 --amount 250
 *   - npx hardhat --network sepolia task:deposit0 --amount 1000 --pool 0xPool --token0 0xToken
 */
task("task:deposit0", "Transfer token0 (ERC20) to the pool contract")
  .addParam("amount", "Human amount (e.g: 100.5)")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV2)")
  .addOptionalParam("token0", "Token0 address (default: USDC_SEPOLIA_ADDRESS from constants)")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const poolDeployment = args.pool ? { address: args.pool } : await deployments.get("PrivacyPoolV2");

    const TOKEN0_DEFAULT = (await import("../constants")).USDC_SEPOLIA_ADDRESS as string;

    const token0Addr: string = args.token0 ?? TOKEN0_DEFAULT;

    console.log(`Pool:  ${poolDeployment.address}`);
    console.log(`Token0: ${token0Addr}`);

    const [signer] = await ethers.getSigners();
    const erc20 = await ethers.getContractAt("IERC20", token0Addr, signer);

    const decimals: number = 6;
    const amountWei = ethers.parseUnits(String(args.amount), decimals);

    const bal = await erc20.balanceOf(signer.address);
    if (bal < amountWei) {
      throw new Error(
        `Insufficient balance: balance=${bal} < amount=${amountWei} (${args.amount} with ${decimals} decimals)`,
      );
    }

    console.log(`➡️  Transferring ${args.amount} (10^${decimals}) to ${poolDeployment.address}`);
    const tx = await erc20.transfer(poolDeployment.address, amountWei);
    console.log(`⏳ tx: ${tx.hash}`);
    const rcpt = await tx.wait();
    console.log(`✅ status=${rcpt?.status} | gasUsed=${rcpt?.gasUsed?.toString()}`);

    try {
      const pool = await ethers.getContractAt("PrivacyPoolV2", poolDeployment.address, signer);
      const [r0, r1v] = await pool.getReserves();
      console.log(`📊 Reserves => token0: ${r0.toString()} | token1Virtual: ${r1v.toString()}`);
    } catch {
      // silence if contract doesn't have getReserves or changes
    }
  });
