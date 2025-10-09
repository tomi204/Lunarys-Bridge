import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

// ------------------------------
// Provide liquidity with TOKEN0
// ------------------------------
task("task:provide0", "Provide liquidity with token0 (ERC20)")
  .addParam("amount", "Human amount (e.g: 1000.5)")
  .addOptionalParam("mintick", "minTick", "-120")
  .addOptionalParam("maxtick", "maxTick", "120")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV2)")
  .addOptionalParam("token0", "Token0 address (default: USDC_SEPOLIA_ADDRESS)")
  .addOptionalParam("to", "NFT beneficiary (default: signer)")
  .addOptionalParam("ttl", "Seconds until deadline (default: 3600)", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV2")).address;
    const TOKEN0_DEFAULT = (await import("../constants")).USDC_SEPOLIA_ADDRESS as string;
    const token0Addr = args.token0 ?? TOKEN0_DEFAULT;

    const [signer] = await ethers.getSigners();
    const to = (args.to ?? signer.address) as string;
    const ttl = Number(args.ttl ?? "3600");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + ttl);

    const minTick = Number(args.mintick ?? -120);
    const maxTick = Number(args.maxtick ?? 120);

    const erc20 = await ethers.getContractAt("IERC20", token0Addr, signer);
    const pool = await ethers.getContractAt("PrivacyPoolV2", poolAddr, signer);

    const dec = 6;
    const amountWei = ethers.parseUnits(String(args.amount), dec);

    // approve
    const bal = await erc20.balanceOf(signer.address);
    if (bal < amountWei) throw new Error(`Insufficient balance: balance=${bal}, amount=${amountWei}`);
    console.log(`➡️  approve(${poolAddr}, ${amountWei})`);
    await (await erc20.approve(poolAddr, amountWei)).wait();

    // pre-calculation (no gas cost)
    const tokenIdStatic = await pool.provideLiquidityToken0.staticCall(minTick, maxTick, amountWei, to, deadline);
    console.log(`🔎 tokenId (static): ${tokenIdStatic}`);

    // execution
    console.log(`➡️  provideLiquidityToken0(${minTick}, ${maxTick}, ${amountWei}, ${to}, ${deadline})`);
    const tx = await pool.provideLiquidityToken0(minTick, maxTick, amountWei, to, deadline);
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);

    try {
      const [r0, r1v] = await pool.getReserves();
      console.log(`📊 Reserves => token0: ${r0.toString()} | token1Virtual: ${r1v.toString()}`);
    } catch {}
  });

// ------------------------------
// Provide liquidity with TOKEN1 (confidential)
// ------------------------------
task("task:provide1", "Provide liquidity with token1 (confidential, ERC-7984)")
  .addParam("amount", "Clear amount for shadow liquidity and virtual reserve (uint64, e.g: 250000)")
  .addOptionalParam("mintick", "minTick", "-90")
  .addOptionalParam("maxtick", "maxTick", "90")
  .addOptionalParam("pool", "Pool address (default: deployments/PrivacyPoolV2)")
  .addOptionalParam("token1", "CERC20 address (default: deployments/CERC20)")
  .addOptionalParam("to", "NFT beneficiary (default: signer)")
  .addOptionalParam("ttl", "Seconds until deadline (default: 3600)", "3600")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    // We need to encrypt, so we initialize the plugin API
    await fhevm.initializeCLIApi();

    const poolAddr = args.pool ?? (await deployments.get("PrivacyPoolV2")).address;
    const token1Addr = args.token1 ?? (await deployments.get("CERC20")).address;

    const [signer] = await ethers.getSigners();
    const to = (args.to ?? signer.address) as string;
    const ttl = Number(args.ttl ?? "3600");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + ttl);

    const minTick = Number(args.mintick ?? -90);
    const maxTick = Number(args.maxtick ?? 90);

    const amountClear = BigInt(args.amount);
    if (amountClear <= 0n) throw new Error("amount must be > 0");
    if (amountClear > BigInt("18446744073709551615")) {
      // 2^64 - 1
      throw new Error("amount exceeds uint64");
    }

    const pool = await ethers.getContractAt("PrivacyPoolV2", poolAddr, signer);
    const cerc20 = await ethers.getContractAt("CERC20", token1Addr, signer);

    const expiry = BigInt(Math.floor(Date.now() / 1000) + 2 * ttl);
    console.log(`➡️  setOperator(${poolAddr}, ${expiry}) on CERC20`);
    const txOp = await cerc20.setOperator(poolAddr, expiry);
    await txOp.wait();

    const encrypted = await fhevm.createEncryptedInput(poolAddr, signer.address).add64(Number(amountClear)).encrypt();

    const tokenIdStatic = await pool.provideLiquidityToken1.staticCall(
      minTick,
      maxTick,
      encrypted.handles[0],
      Number(amountClear),
      to,
      encrypted.inputProof,
      deadline,
    );
    console.log(`🔎 tokenId (static): ${tokenIdStatic}`);

    const tx = await pool.provideLiquidityToken1(
      minTick,
      maxTick,
      encrypted.handles[0],
      Number(amountClear),
      to,
      encrypted.inputProof,
      deadline,
    );
    console.log(`⏳ tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`✅ status=${rc?.status} gas=${rc?.gasUsed}`);

    try {
      const [r0, r1v] = await pool.getReserves();
      console.log(`📊 Reserves => token0: ${r0.toString()} | token1Virtual: ${r1v.toString()}`);
    } catch {}
  });
