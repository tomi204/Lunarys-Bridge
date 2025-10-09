import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Deposits token1 (CERC20) into the pool using confidentialTransfer.
 *
 * Examples:
 *   - npx hardhat --network sepolia task:deposit1 --amount 750000
 *   - npx hardhat --network sepolia task:deposit1 --amount 250000 --pool 0xPool --token1 0xCERC20
 *
 * Note:
 *   Uses FHEVM to generate (handle, proof) and then calls:
 *   CERC20.confidentialTransfer(address to, bytes32 handle, bytes proof)
 */
task("task:deposit1", "Transfer token1 (CERC20, encrypted) to the pool contract")
  .addParam("amount", "Amount uint64 (e.g: 750000)")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV2)")
  .addOptionalParam("token1", "CERC20 address (default: deployments/CERC20)")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    // 1) Initialize FHE CLI API to encrypt inputs
    await fhevm.initializeCLIApi();

    // 2) Resolve addresses
    const poolDeployment = args.pool ? { address: args.pool } : await deployments.get("PrivacyPoolV2");

    const token1Deployment = args.token1 ? { address: args.token1 } : await deployments.get("CERC20");

    console.log(`Pool :  ${poolDeployment.address}`);
    console.log(`Token1: ${token1Deployment.address}`);
    console.log(`Amount: ${args.amount} (uint64)`);

    // 3) Signer and contract
    const [signer] = await ethers.getSigners();
    const cerc20 = await ethers.getContractAt("CERC20", token1Deployment.address, signer);

    // 4) Generate encrypted input (uint64) for CERC20
    const enc = await fhevm
      .createEncryptedInput(token1Deployment.address, signer.address)
      .add64(Number(args.amount))
      .encrypt();

    // 5) confidentialTransfer to pool
    console.log(`➡️  confidentialTransfer -> ${poolDeployment.address}`);
    const tx = await cerc20["confidentialTransfer(address,bytes32,bytes)"](
      poolDeployment.address,
      enc.handles[0],
      enc.inputProof,
    );
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gasUsed=${rc?.gasUsed?.toString()}`);

    // 6) (Optional) show reserves if pool exposes getReserves()
    try {
      const pool = await ethers.getContractAt("PrivacyPoolV2", poolDeployment.address, signer);
      const [r0, r1v] = await pool.getReserves();
      console.log(`📊 Reserves => token0: ${r0.toString()} | token1Virtual: ${r1v.toString()}`);
    } catch {
      // silence if getReserves doesn't exist or changes
    }
  });
