// deploy/PrivacyPoolV3.ts
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { postDeploy } from "postdeploy";
import { USDC_SEPOLIA_ADDRESS } from "../constants";

const DEPOSIT0 = 1_000_000; // 1 USDC (6 decimals)
const DEPOSIT1 = 750_000; // 750k token1 units
const VIRTUAL1 = 750_000;
const FEE_BPS = 3000; // 0.3%
const TICK_SPACING = 60;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network, ethers, fhevm } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainName = network.name;

  await fhevm.initializeCLIApi();

  log("========================================");
  log("Deploying PrivacyPoolV3 (Hybrid: Public Token0 + Confidential Token1)");
  log("========================================");

  // 1) Deploy CERC20 (confidential token1)
  const cerc20 = await deploy("CERC20_V3", {
    contract: "CERC20",
    from: deployer,
    args: [deployer, 1_000_000_000, "Confidential Token V3", "CTKN3", ""],
    log: true,
    waitConfirmations: 1,
  });

  // 2) Deploy PositionNFT
  const positionNft = await deploy("PositionNFT_V3", {
    contract: "PositionNFT",
    from: deployer,
    args: [deployer],
    log: true,
    waitConfirmations: 1,
  });

  // 3) Deploy PrivacyPoolV3
  const pool = await deploy("PrivacyPoolV3", {
    from: deployer,
    args: [
      USDC_SEPOLIA_ADDRESS, // token0 (public)
      cerc20.address, // token1 (confidential)
      FEE_BPS,
      TICK_SPACING,
      positionNft.address,
      deployer,
    ],
    log: true,
    waitConfirmations: 1,
  });

  log(`CERC20_V3:        ${cerc20.address}`);
  log(`PositionNFT_V3:   ${positionNft.address}`);
  log(`PrivacyPoolV3:    ${pool.address}`);

  // 4) Generate frontend artifacts
  postDeploy(chainName, "CERC20_V3");
  postDeploy(chainName, "PositionNFT_V3");
  postDeploy(chainName, "PrivacyPoolV3");

  // 5) Seed the pool
  const signer = await ethers.getSigner(deployer);
  const token0 = await ethers.getContractAt("IERC20", USDC_SEPOLIA_ADDRESS, signer);
  const token1 = await ethers.getContractAt("CERC20", cerc20.address, signer);
  const poolCtr = await ethers.getContractAt("PrivacyPoolV3", pool.address, signer);

  // 5.1) Transfer token0 (public)
  const bal0 = await token0.balanceOf(deployer);
  if (bal0 >= DEPOSIT0) {
    log(`Transferring ${DEPOSIT0} token0 to pool...`);
    const tx0 = await token0.transfer(pool.address, DEPOSIT0);
    await tx0.wait();
  } else {
    log(`WARNING: deployer has insufficient USDC (${bal0}) to transfer ${DEPOSIT0}`);
  }

  // 5.2) Transfer token1 (confidential)
  const token1Address = await token1.getAddress();
  const enc = await fhevm.createEncryptedInput(token1Address, deployer).add64(DEPOSIT1).encrypt();

  log(`Transferring ${DEPOSIT1} token1 (confidential) to pool...`);
  const tx1 = await token1["confidentialTransfer(address,bytes32,bytes)"](
    pool.address,
    enc.handles[0],
    enc.inputProof,
  );
  await tx1.wait();

  // 5.3) Seed virtual reserves
  log(`Seeding virtual reserves: r1Virtual = ${VIRTUAL1}`);
  const tx2 = await poolCtr.seedVirtualReserves(VIRTUAL1);
  await tx2.wait();

  // 5.4) Verify reserves
  const [r0, r1v] = await poolCtr.getReserves();
  log(`✅ Reserves => token0: ${r0.toString()}, token1Virtual: ${r1v.toString()}`);
  log("========================================");
};

export default func;

func.id = "deploy_privacy_pool_v3";
func.tags = ["PrivacyPoolV3", "V3"];
