// deploy/01_privacyPool.ts
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { postDeploy } from "postdeploy";
import { USDC_SEPOLIA_ADDRESS } from "../constants";

const DEPOSIT0 = 1000000;
const DEPOSIT1 = 750_000;
const VIRTUAL1 = 750_000;
const FEE_BPS = 3000;
const DURATION = 60;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network, ethers, fhevm } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainName = network.name;

  await fhevm.initializeCLIApi();

  // 2) Deploys
  const cerc20 = await deploy("CERC20", {
    from: deployer,
    args: [deployer, 1_000_000_000, "Conf Token", "CTKN", ""],
    log: true,
    waitConfirmations: 1,
  });

  const positionNft = await deploy("PositionNFT", {
    from: deployer,
    args: [deployer],
    log: true,
    waitConfirmations: 1,
  });

  const pool = await deploy("PrivacyPoolV2", {
    from: deployer,
    args: [
      USDC_SEPOLIA_ADDRESS, // token0
      cerc20.address, // token1 (confidencial)
      FEE_BPS,
      DURATION,
      positionNft.address,
      deployer,
    ],
    log: true,
    waitConfirmations: 1,
  });

  log(`CERC20:        ${cerc20.address}`);
  log(`PositionNFT:   ${positionNft.address}`);
  log(`PrivacyPoolV2: ${pool.address}`);

  // 3) Generar artefactos front por red correcta
  postDeploy(chainName, "CERC20");
  postDeploy(chainName, "PositionNFT");
  postDeploy(chainName, "PrivacyPoolV2");

  // 4) Post-deploy: replicar EXACTO el seed de tus tests
  const signer = await ethers.getSigner(deployer);
  const token0 = await ethers.getContractAt("IERC20", USDC_SEPOLIA_ADDRESS, signer);
  const token1 = await ethers.getContractAt("CERC20", cerc20.address, signer);
  const poolCtr = await ethers.getContractAt("PrivacyPoolV2", pool.address, signer);

  // 4.1) Token0 -> pool
  const bal0 = await token0.balanceOf(deployer);
  if (bal0 >= DEPOSIT0) {
    const tx0 = await token0.transfer(pool.address, DEPOSIT0);
    await tx0.wait();
  } else {
    log(`WARNING: deployer no tiene USDC suficiente (${bal0}) para transferir ${DEPOSIT0}`);
  }

  const token1Address = await token1.getAddress();
  const enc = await fhevm.createEncryptedInput(token1Address, deployer).add64(DEPOSIT1).encrypt();

  const tx1 = await token1["confidentialTransfer(address,bytes32,bytes)"](pool.address, enc.handles[0], enc.inputProof);
  await tx1.wait();

  // 4.3) seedVirtualReserves
  const tx2 = await poolCtr.seedVirtualReserves(VIRTUAL1);
  await tx2.wait();

  // 4.4) Verification log
  const [r0, r1v] = await poolCtr.getReserves();
  log(`Reserves => token0: ${r0.toString()}, token1Virtual: ${r1v.toString()}`);
};

export default func;

func.id = "deploy_privacy_pool_v2_with_conf_seed";
func.tags = ["PrivacyPool", "CERC20", "PositionNFT", "Seed"];
