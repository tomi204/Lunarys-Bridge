import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Get the deployer signer
  const signers = await hre.ethers.getSigners();
  const deployerSigner = signers[0];

  console.log("Deploying Relayer contract...");
  console.log("Deployer address:", deployer);

  // For initial deployment, use deployer as relayer
  // In production, you would use a dedicated relayer address
  const relayerAddress = deployer;

  const relayer = await deploy("Relayer", {
    from: deployer,
    args: [
      relayerAddress, // relayer address
      deployer, // initial owner
    ],
    log: true,
    autoMine: true,
  });

  console.log("Relayer deployed to:", relayer.address);
  console.log("Relayer address:", relayerAddress);
  console.log("Owner:", deployer);

  // Optional: Configure the relayer after deployment
  if (relayer.newlyDeployed) {
    console.log("Configuring Relayer...");

    const relayerContract = await hre.ethers.getContractAt("Relayer", relayer.address);

    // Set initial fee parameters if needed
    // await relayerContract.updateFeePercentage(30); // 0.3% default is already set

    console.log("Relayer configuration complete");
  }

  return true;
};

func.id = "deploy_relayer";
func.tags = ["Relayer"];
func.dependencies = []; // Add dependencies if needed

export default func;
