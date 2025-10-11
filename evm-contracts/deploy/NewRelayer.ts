import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("========================================");
  log("Deploying NewRelayer");
  log("========================================");

  // For initial deployment, use deployer as relayer
  // In production, you would use a dedicated relayer address
  const relayerAddress = deployer;

  const newRelayer = await deploy("NewRelayer", {
    from: deployer,
    args: [
      relayerAddress, // relayer address
      deployer, // initial owner
    ],
    log: true,
    waitConfirmations: network.name === "sepolia" ? 5 : 1,
  });

  log(`NewRelayer deployed at: ${newRelayer.address}`);
  log(`Relayer address: ${relayerAddress}`);
  log(`Owner: ${deployer}`);
  log("========================================");

  // Optional: Configure nodes after deployment
  if (newRelayer.newlyDeployed) {
    log("NewRelayer is newly deployed. You can authorize nodes using:");
    log(`  npx hardhat newrelayer:authorize-node --node <address> --network ${network.name}`);
  }
};

export default func;

func.id = "deploy_new_relayer";
func.tags = ["NewRelayer"];
