import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n📦 Deploying RewardsPool...");
  console.log("Deployer:", deployer);

  // Get deployed staking token address (or deploy a mock one)
  let stakingTokenAddress: string;
  let rewardsTokenAddress: string;

  // Try to get existing deployments, otherwise deploy mocks
  try {
    const existingStakingToken = await hre.deployments.get("MockERC20");
    stakingTokenAddress = existingStakingToken.address;
    console.log("✅ Using existing staking token:", stakingTokenAddress);
  } catch {
    console.log("📝 Deploying mock staking token...");
    const stakingTokenDeployment = await deploy("MockERC20", {
      contract: "contracts/mocks/MockERC20.sol:MockERC20",
      from: deployer,
      args: ["Staking Token", "STK", hre.ethers.parseEther("10000000")],
      log: true,
    });
    stakingTokenAddress = stakingTokenDeployment.address;
    console.log("✅ Mock staking token deployed:", stakingTokenAddress);
  }

  // Try to get existing CERC20 token, otherwise deploy one
  try {
    const existingRewardsToken = await hre.deployments.get("CERC20");
    rewardsTokenAddress = existingRewardsToken.address;
    console.log("✅ Using existing rewards token:", rewardsTokenAddress);
  } catch {
    console.log("📝 Deploying CERC20 rewards token...");
    const rewardsTokenDeployment = await deploy("CERC20", {
      from: deployer,
      args: [deployer, 10000000, "Rewards Token", "RTKN", "https://example.com/rewards"],
      log: true,
    });
    rewardsTokenAddress = rewardsTokenDeployment.address;
    console.log("✅ CERC20 rewards token deployed:", rewardsTokenAddress);
  }

  // Deploy RewardsPool
  const rewardsPool = await deploy("RewardsPool", {
    from: deployer,
    args: [stakingTokenAddress, rewardsTokenAddress, deployer],
    log: true,
  });

  console.log("✅ RewardsPool deployed at:", rewardsPool.address);

  // Initialize pool with some rewards tokens if just deployed
  if (rewardsPool.newlyDeployed) {
    console.log("📝 Minting rewards tokens to pool...");
    const rewardsToken = await hre.ethers.getContractAt("CERC20", rewardsTokenAddress);
    const mintTx = await rewardsToken.mint(rewardsPool.address, 10000000); // 10M tokens
    await mintTx.wait();
    console.log("✅ Minted 10M rewards tokens to pool");
  }

  console.log("\n📊 RewardsPool Configuration:");
  const poolContract = await hre.ethers.getContractAt("RewardsPool", rewardsPool.address);
  console.log("  Staking Token:", await poolContract.stakingToken());
  console.log("  Rewards Token:", await poolContract.rewardsToken());
  console.log("  Base APY:", (await poolContract.baseAPY()).toString(), "bps (100% = 10000)");
  console.log("  Min APY:", (await poolContract.minAPY()).toString(), "bps");
  console.log("  Target Liquidity:", hre.ethers.formatEther(await poolContract.targetLiquidity()), "tokens");
  console.log("  Current APY:", (await poolContract.getCurrentAPY()).toString(), "bps");

  // Verify contracts on Etherscan if not local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n🔍 Waiting for block confirmations before verification...");
    await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds

    try {
      console.log("📝 Verifying RewardsPool on Etherscan...");
      await hre.run("verify:verify", {
        address: rewardsPool.address,
        constructorArguments: [stakingTokenAddress, rewardsTokenAddress, deployer],
      });
      console.log("✅ RewardsPool verified on Etherscan");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ RewardsPool already verified");
      } else {
        console.log("❌ Verification failed:", error.message);
      }
    }
  }

  console.log("\n✅ RewardsPool deployment complete!\n");
};

export default func;
func.tags = ["RewardsPool"];
