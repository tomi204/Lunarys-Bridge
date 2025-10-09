// deploy/PrivacyPoolV5.ts
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { postDeploy } from "postdeploy";

const DEPOSIT0 = 1_000_000;
const DEPOSIT1 = 750_000;
const FEE_BPS = 3000; // 0.3%
const TICK_SPACING = 60;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network, ethers } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainName = network.name;

  log("========================================");
  log("Deploying PrivacyPoolV5 (Public Tokens with Private Swap Amounts)");
  log("========================================");

  // 1) Deploy MockERC20 tokens (both public)
  const token0 = await deploy("MockERC20_V5_Token0", {
    contract: "MockERC20",
    from: deployer,
    args: ["Public Token0 V5", "PTK5-0", deployer, ethers.parseEther("1000000000")],
    log: true,
    waitConfirmations: 1,
  });

  const token1 = await deploy("MockERC20_V5_Token1", {
    contract: "MockERC20",
    from: deployer,
    args: ["Public Token1 V5", "PTK5-1", deployer, ethers.parseEther("1000000000")],
    log: true,
    waitConfirmations: 1,
  });

  // 2) Deploy PositionNFT
  const positionNft = await deploy("PositionNFT_V5", {
    contract: "PositionNFT",
    from: deployer,
    args: [deployer],
    log: true,
    waitConfirmations: 1,
  });

  // 3) Deploy PrivacyPoolV5
  const pool = await deploy("PrivacyPoolV5", {
    from: deployer,
    args: [token0.address, token1.address, FEE_BPS, TICK_SPACING, positionNft.address, deployer],
    log: true,
    waitConfirmations: 1,
  });

  log(`MockERC20_V5_Token0: ${token0.address}`);
  log(`MockERC20_V5_Token1: ${token1.address}`);
  log(`PositionNFT_V5:      ${positionNft.address}`);
  log(`PrivacyPoolV5:       ${pool.address}`);

  // 4) Generate frontend artifacts
  postDeploy(chainName, "MockERC20_V5_Token0");
  postDeploy(chainName, "MockERC20_V5_Token1");
  postDeploy(chainName, "PositionNFT_V5");
  postDeploy(chainName, "PrivacyPoolV5");

  // 5) Seed the pool
  const signer = await ethers.getSigner(deployer);
  const token0Ctr = await ethers.getContractAt("MockERC20", token0.address, signer);
  const token1Ctr = await ethers.getContractAt("MockERC20", token1.address, signer);
  const poolCtr = await ethers.getContractAt("PrivacyPoolV5", pool.address, signer);

  // 5.1) Transfer token0 (public)
  log(`Transferring ${DEPOSIT0} token0 to pool...`);
  const tx0 = await token0Ctr.transfer(pool.address, DEPOSIT0);
  await tx0.wait();

  // 5.2) Transfer token1 (public)
  log(`Transferring ${DEPOSIT1} token1 to pool...`);
  const tx1 = await token1Ctr.transfer(pool.address, DEPOSIT1);
  await tx1.wait();

  // 5.3) Seed reserves
  log(`Seeding reserves...`);
  const tx2 = await poolCtr.seedReserves();
  await tx2.wait();

  // 5.4) Verify reserves
  const [r0, r1] = await poolCtr.getReserves();
  log(`✅ Reserves => token0: ${r0.toString()}, token1: ${r1.toString()}`);
  log("========================================");
};

export default func;

func.id = "deploy_privacy_pool_v5";
func.tags = ["PrivacyPoolV5", "V5"];
