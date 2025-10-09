import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

// ==================== POOLV4 LIQUIDITY (Fully Confidential) ====================

task("v4:provide", "Provide liquidity on PrivacyPoolV4 (async)")
  .addParam("amount", "Amount to provide (uint64)")
  .addParam("token", "Which token: 0=token0, 1=token1")
  .addOptionalParam("mintick", "minTick", "-120")
  .addOptionalParam("maxtick", "maxTick", "120")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV4)")
  .addOptionalParam("ttl", "Seconds until deadline", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV4")).address;
    const [signer] = await ethers.getSigners();

    const pool = await ethers.getContractAt("PrivacyPoolV4", poolAddr, signer);

    const isToken0 = args.token === "0";
    const amount = Number(args.amount);
    const tickLower = Number(args.mintick ?? "-120");
    const tickUpper = Number(args.maxtick ?? "120");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    console.log(`💰 Providing ${amount} ${isToken0 ? "token0" : "token1"} (ticks: ${tickLower} to ${tickUpper})`);

    // Get token address and set operator
    const tokenAddr = isToken0 ? await pool.token0() : await pool.token1();
    const token = await ethers.getContractAt("CERC20", tokenAddr, signer);

    const expiry = BigInt(Math.floor(Date.now() / 1000) + 2 * Number(args.ttl ?? "3600"));
    console.log(`➡️  setOperator(${poolAddr}, ${expiry})`);
    await (await token.setOperator(poolAddr, expiry)).wait();

    // Encrypt amount
    const enc = await fhevm.createEncryptedInput(poolAddr, signer.address).add64(amount).encrypt();

    // Provide liquidity
    console.log(`➡️  provideLiquidity${isToken0 ? "Token0" : "Token1"}(...)`);
    const tx = isToken0
      ? await pool.provideLiquidityToken0(tickLower, tickUpper, enc.handles[0], amount, signer.address, enc.inputProof, deadline)
      : await pool.provideLiquidityToken1(tickLower, tickUpper, enc.handles[0], amount, signer.address, enc.inputProof, deadline);

    console.log(`⏳ tx: ${tx.hash} (async, requestId will be in logs)`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);
    console.log(`⚠️  Wait for decryption callback to finalize liquidity provision`);
  });

task("v4:burn", "Burn liquidity position on PrivacyPoolV4")
  .addParam("tokenid", "Position NFT token ID")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV4)")
  .addOptionalParam("ttl", "Seconds until deadline", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV4")).address;
    const [signer] = await ethers.getSigners();

    const pool = await ethers.getContractAt("PrivacyPoolV4", poolAddr, signer);
    const tokenId = BigInt(args.tokenid);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(args.ttl ?? "3600"));

    console.log(`🔥 Burning position tokenId: ${tokenId}`);

    const tx = await pool.burnPosition(tokenId, deadline);
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);

    const [r0v, r1v] = await pool.getReserves();
    console.log(`📊 Reserves => token0Virtual: ${r0v.toString()} | token1Virtual: ${r1v.toString()}`);
  });
