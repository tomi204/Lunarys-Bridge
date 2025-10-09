// deploy/PrivacyPoolV4.ts
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { postDeploy } from "postdeploy";

const DEPOSIT0 = 1_000_000;
const DEPOSIT1 = 750_000;
const VIRTUAL0 = 1_000_000;
const VIRTUAL1 = 750_000;
const FIXED_FEE = 100; // 100 units
const TICK_SPACING = 60;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network, ethers, fhevm } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainName = network.name;

  await fhevm.initializeCLIApi();

  log("========================================");
  log("Deploying PrivacyPoolV4 (Fully Confidential: Both Tokens Encrypted)");
  log("========================================");

  // 1) Deploy CERC20 tokens (both confidential)
  const cerc20Token0 = await deploy("CERC20_V4_Token0", {
    contract: "CERC20",
    from: deployer,
    args: [deployer, 1_000_000_000, "Confidential Token0 V4", "CTKN4-0", ""],
    log: true,
    waitConfirmations: 1,
  });

  const cerc20Token1 = await deploy("CERC20_V4_Token1", {
    contract: "CERC20",
    from: deployer,
    args: [deployer, 1_000_000_000, "Confidential Token1 V4", "CTKN4-1", ""],
    log: true,
    waitConfirmations: 1,
  });

  const rewardToken = await deploy("CERC20_V4_Reward", {
    contract: "CERC20",
    from: deployer,
    args: [deployer, 1_000_000_000, "Reward Token V4", "REWARD4", ""],
    log: true,
    waitConfirmations: 1,
  });

  // 2) Deploy PositionNFT
  const positionNft = await deploy("PositionNFT_V4", {
    contract: "PositionNFT",
    from: deployer,
    args: [deployer],
    log: true,
    waitConfirmations: 1,
  });

  // 3) Deploy PrivacyPoolV4
  const pool = await deploy("PrivacyPoolV4", {
    from: deployer,
    args: [
      cerc20Token0.address, // token0 (confidential)
      cerc20Token1.address, // token1 (confidential)
      rewardToken.address, // rewardToken
      FIXED_FEE,
      TICK_SPACING,
      positionNft.address,
      deployer,
    ],
    log: true,
    waitConfirmations: 1,
  });

  log(`CERC20_V4_Token0:  ${cerc20Token0.address}`);
  log(`CERC20_V4_Token1:  ${cerc20Token1.address}`);
  log(`CERC20_V4_Reward:  ${rewardToken.address}`);
  log(`PositionNFT_V4:    ${positionNft.address}`);
  log(`PrivacyPoolV4:     ${pool.address}`);

  // 4) Generate frontend artifacts
  postDeploy(chainName, "CERC20_V4_Token0");
  postDeploy(chainName, "CERC20_V4_Token1");
  postDeploy(chainName, "CERC20_V4_Reward");
  postDeploy(chainName, "PositionNFT_V4");
  postDeploy(chainName, "PrivacyPoolV4");

  // 5) Seed the pool
  const signer = await ethers.getSigner(deployer);
  const token0 = await ethers.getContractAt("CERC20", cerc20Token0.address, signer);
  const token1 = await ethers.getContractAt("CERC20", cerc20Token1.address, signer);
  const reward = await ethers.getContractAt("CERC20", rewardToken.address, signer);
  const poolCtr = await ethers.getContractAt("PrivacyPoolV4", pool.address, signer);

  // 5.1) Transfer token0 (confidential)
  const token0Address = await token0.getAddress();
  const enc0 = await fhevm.createEncryptedInput(token0Address, deployer).add64(DEPOSIT0).encrypt();

  log(`Transferring ${DEPOSIT0} token0 (confidential) to pool...`);
  const tx0 = await token0["confidentialTransfer(address,bytes32,bytes)"](
    pool.address,
    enc0.handles[0],
    enc0.inputProof,
  );
  await tx0.wait();

  // 5.2) Transfer token1 (confidential)
  const token1Address = await token1.getAddress();
  const enc1 = await fhevm.createEncryptedInput(token1Address, deployer).add64(DEPOSIT1).encrypt();

  log(`Transferring ${DEPOSIT1} token1 (confidential) to pool...`);
  const tx1 = await token1["confidentialTransfer(address,bytes32,bytes)"](
    pool.address,
    enc1.handles[0],
    enc1.inputProof,
  );
  await tx1.wait();

  // 5.3) Transfer reward tokens to pool
  const rewardAddress = await reward.getAddress();
  const encReward = await fhevm.createEncryptedInput(rewardAddress, deployer).add64(10_000_000).encrypt();

  log(`Transferring 10M reward tokens to pool...`);
  const txReward = await reward["confidentialTransfer(address,bytes32,bytes)"](
    pool.address,
    encReward.handles[0],
    encReward.inputProof,
  );
  await txReward.wait();

  // 5.4) Seed virtual reserves
  log(`Seeding virtual reserves: r0Virtual = ${VIRTUAL0}, r1Virtual = ${VIRTUAL1}`);
  const tx2 = await poolCtr.seedVirtualReserves(VIRTUAL0, VIRTUAL1);
  await tx2.wait();

  // 5.5) Verify reserves
  const [r0, r1v] = await poolCtr.getReserves();
  log(`✅ Reserves => token0Virtual: ${r0.toString()}, token1Virtual: ${r1v.toString()}`);
  log("========================================");
};

export default func;

func.id = "deploy_privacy_pool_v4";
func.tags = ["PrivacyPoolV4", "V4"];
