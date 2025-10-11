// deploy/UniversalRouter.ts
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("========================================");
  log("Deploying UniversalRouter");
  log("========================================");

  // Deploy UniversalRouter
  const router = await deploy("UniversalRouter", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: network.name === "sepolia" ? 5 : 1,
  });

  log(`UniversalRouter deployed at: ${router.address}`);
  log("========================================");
};

export default func;

func.id = "deploy_universal_router";
func.tags = ["UniversalRouter", "Router"];
