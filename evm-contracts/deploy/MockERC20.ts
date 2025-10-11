import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // Config por env (opcional) con defaults
  const NAME = process.env.MOCK_NAME ?? "Mock USD Coin";
  const SYMBOL = process.env.MOCK_SYMBOL ?? "mUSDC";
  const DECIMALS = Number(process.env.MOCK_DECIMALS ?? "18"); // tu contrato fija 18, esto es solo para parseUnits
  const WHOLE_SUPPLY = process.env.MOCK_SUPPLY ?? "1000000"; // 1,000,000 tokens

  const initialSupply = ethers.parseUnits(WHOLE_SUPPLY, DECIMALS); // bigint

  log("----------------------------------------------------");
  log(`Network: ${network.name}`);
  log(`Deployer: ${deployer}`);
  log(`Deploying MockERC20 => name=${NAME}, symbol=${SYMBOL}, supply=${WHOLE_SUPPLY} * 10^${DECIMALS}`);

  const deployed = await deploy("MockERC20", {
    from: deployer,
    args: [NAME, SYMBOL, initialSupply],
    log: true,
    autoMine: true, // solo afecta a redes locales
    waitConfirmations: network.live ? 2 : 0,
  });

  log(`MockERC20 deployed at: ${deployed.address}`);

  // (Opcional) Verificación automática si tenés ETHERSCAN_API_KEY configurado
  if (network.live && deployed.newlyDeployed && process.env.ETHERSCAN_API_KEY) {
    try {
      await hre.run("verify:verify", {
        address: deployed.address,
        constructorArguments: [NAME, SYMBOL, initialSupply.toString()],
      });
      log("MockERC20 verified ✅");
    } catch (e: any) {
      log(`Etherscan verify skipped/failed: ${e.message ?? e}`);
    }
  }

  return true;
};

func.id = "deploy_mock_erc20";
func.tags = ["MockERC20", "mocks"];
func.dependencies = []; // si querés depender de algo, lo agregás acá

export default func;
