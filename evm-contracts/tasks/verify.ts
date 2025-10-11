import { task } from "hardhat/config";

task("task:verify-all", "Verifica CERC20, PositionNFT y PrivacyPoolV2 en Etherscan")
  .addOptionalParam("fee", "fee bps del pool", "3000")
  .addOptionalParam("tick", "tickSpacing", "60")
  .setAction(async (args, hre) => {
    const { deployments, run, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();

    // lee USDC sepolia del repo
    const USDC = (await import("../constants")).USDC_SEPOLIA_ADDRESS as string;

    // CERC20
    const cerc20 = await deployments.get("CERC20");
    try {
      await run("verify:verify", {
        address: cerc20.address,
        constructorArguments: [deployer, 1_000_000_000, "Conf Token", "CTKN", ""],
      });
      console.log(`✅ CERC20 verificado en ${cerc20.address}`);
    } catch (e: any) {
      if ((e.message || "").includes("Already Verified")) console.log("ℹ️ CERC20 ya verificado");
      else throw e;
    }

    // PositionNFT
    const pos = await deployments.get("PositionNFT");
    try {
      await run("verify:verify", {
        address: pos.address,
        constructorArguments: [deployer],
      });
      console.log(`✅ PositionNFT verificado en ${pos.address}`);
    } catch (e: any) {
      if ((e.message || "").includes("Already Verified")) console.log("ℹ️ PositionNFT ya verificado");
      else throw e;
    }

    // PrivacyPoolV2
    const pool = await deployments.get("PrivacyPoolV2");
    try {
      await run("verify:verify", {
        address: pool.address,
        constructorArguments: [USDC, cerc20.address, Number(args.fee), Number(args.tick), pos.address, deployer],
      });
      console.log(`✅ PrivacyPoolV2 verificado en ${pool.address}`);
    } catch (e: any) {
      if ((e.message || "").includes("Already Verified")) console.log("ℹ️ PrivacyPoolV2 ya verificado");
      else throw e;
    }
  });
