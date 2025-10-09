// deploy/UniversalRouter.ts
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { postDeploy } from "postdeploy";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network, ethers } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainName = network.name;

  log("========================================");
  log("Deploying UniversalRouter");
  log("========================================");

  // Deploy UniversalRouter
  const router = await deploy("UniversalRouter", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });

  log(`UniversalRouter: ${router.address}`);

  // Generate frontend artifacts
  postDeploy(chainName, "UniversalRouter");

  // Register pools if they exist
  const signer = await ethers.getSigner(deployer);
  const routerCtr = await ethers.getContractAt("UniversalRouter", router.address, signer);

  try {
    const poolV3 = await get("PrivacyPoolV3");
    log(`Registering PrivacyPoolV3: ${poolV3.address}`);
    const txV3 = await routerCtr.registerPoolV3(poolV3.address);
    await txV3.wait();
    log(`✅ PrivacyPoolV3 registered`);
  } catch (e) {
    log(`⚠️  PrivacyPoolV3 not found, skipping registration`);
  }

  try {
    const poolV4 = await get("PrivacyPoolV4");
    log(`Registering PrivacyPoolV4: ${poolV4.address}`);
    const txV4 = await routerCtr.registerPoolV4(poolV4.address);
    await txV4.wait();
    log(`✅ PrivacyPoolV4 registered`);
  } catch (e) {
    log(`⚠️  PrivacyPoolV4 not found, skipping registration`);
  }

  try {
    const poolV5 = await get("PrivacyPoolV5");
    log(`Registering PrivacyPoolV5: ${poolV5.address}`);
    const txV5 = await routerCtr.registerPoolV5(poolV5.address);
    await txV5.wait();
    log(`✅ PrivacyPoolV5 registered`);
  } catch (e) {
    log(`⚠️  PrivacyPoolV5 not found, skipping registration`);
  }

  log("========================================");
};

export default func;

func.id = "deploy_universal_router";
func.tags = ["UniversalRouter", "Router"];
func.dependencies = ["PrivacyPoolV3", "PrivacyPoolV4", "PrivacyPoolV5"];
