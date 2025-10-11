import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { createInstance } from "@fhevm/hardhat-plugin";

task("relayer:bridge")
  .addParam("token", "Token address to bridge")
  .addParam("amount", "Amount to bridge (in ETH units)")
  .addParam("destination", "Solana destination address")
  .setDescription("Bridge tokens to Solana with encrypted destination")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();

    console.log("Bridging tokens to Solana...");
    console.log("Signer:", signer.address);

    // Get deployed contracts
    const relayerDeployment = await deployments.get("Relayer");
    const relayer = await ethers.getContractAt("Relayer", relayerDeployment.address);

    const token = await ethers.getContractAt("MockERC20", taskArguments.token);

    // Parse amount
    const amount = ethers.parseEther(taskArguments.amount);
    console.log("Token:", taskArguments.token);
    console.log("Amount:", amount.toString());
    console.log("Destination:", taskArguments.destination);

    // Check balance
    const balance = await token.balanceOf(signer.address);
    console.log("Token balance:", ethers.formatEther(balance));

    if (balance < amount) {
      throw new Error("Insufficient token balance");
    }

    // Create FHE instance
    const fhevmInstance = await createInstance({
      chainId: hre.network.config.chainId || 31337,
      networkUrl: hre.network.config?.url || "http://localhost:8545",
      gatewayUrl: process.env.GATEWAY_URL || "http://localhost:8545",
    });

    // Encrypt Solana destination address
    console.log("Encrypting destination address...");
    const encryptedDestination = fhevmInstance.encryptAddress(taskArguments.destination);

    // Approve tokens
    console.log("Approving tokens...");
    const approveTx = await token.approve(relayerDeployment.address, amount);
    await approveTx.wait();
    console.log("Tokens approved");

    // Initiate bridge
    console.log("Initiating bridge...");
    const tx = await relayer.initiateBridge(
      taskArguments.token,
      amount,
      encryptedDestination.handles[0],
      encryptedDestination.inputProof,
    );

    const receipt = await tx.wait();
    console.log("Bridge initiated!");
    console.log("Transaction hash:", receipt.hash);

    // Get bridge nonce (request ID)
    const bridgeNonce = await relayer.bridgeNonce();
    console.log("Bridge Request ID:", bridgeNonce.toString());

    // Get fee info
    const collectedFees = await relayer.getCollectedFees(taskArguments.token);
    console.log("Collected fees for token:", ethers.formatEther(collectedFees));

    console.log("\nBridge request created successfully!");
    console.log("Waiting for FHE decryption...");
    console.log("Relayer will process the bridge after decryption completes.");
  });

task("relayer:finalize")
  .addParam("requestid", "Bridge request ID to finalize")
  .setDescription("Finalize a bridge to Solana after off-chain execution (relayer only)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();

    console.log("Finalizing bridge request...");
    console.log("Relayer:", signer.address);
    console.log("Request ID:", taskArguments.requestid);

    const relayerDeployment = await deployments.get("Relayer");
    const relayer = await ethers.getContractAt("Relayer", relayerDeployment.address);

    // Check if signer is the relayer
    const authorizedRelayer = await relayer.relayer();
    if (signer.address !== authorizedRelayer) {
      throw new Error(`Only relayer can finalize bridges. Authorized: ${authorizedRelayer}, You: ${signer.address}`);
    }

    // Get bridge request
    const request = await relayer.getBridgeRequest(taskArguments.requestid);
    console.log("Bridge Request:");
    console.log("  Sender:", request.sender);
    console.log("  Token:", request.token);
    console.log("  Amount:", ethers.formatEther(request.amount));
    console.log("  Finalized:", request.finalized);

    if (request.finalized) {
      console.log("Bridge request already finalized");
      return;
    }

    // Finalize bridge
    console.log("Finalizing bridge...");
    const tx = await relayer.finalizeBridge(taskArguments.requestid);
    const receipt = await tx.wait();

    console.log("Bridge finalized!");
    console.log("Transaction hash:", receipt.hash);
    console.log("\nNote: Relayer should have already executed the bridge to Solana off-chain");
  });

task("relayer:deliver")
  .addParam("recipient", "Recipient address on EVM")
  .addParam("token", "Token address to deliver")
  .addParam("amount", "Amount to deliver (in ETH units)")
  .setDescription("Deliver tokens from Solana bridge (relayer only)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();

    console.log("Delivering tokens from Solana bridge...");
    console.log("Relayer:", signer.address);
    console.log("Recipient:", taskArguments.recipient);
    console.log("Token:", taskArguments.token);
    console.log("Amount:", taskArguments.amount);

    const relayerDeployment = await deployments.get("Relayer");
    const relayer = await ethers.getContractAt("Relayer", relayerDeployment.address);

    // Check if signer is the relayer
    const authorizedRelayer = await relayer.relayer();
    if (signer.address !== authorizedRelayer) {
      throw new Error(`Only relayer can deliver tokens. Authorized: ${authorizedRelayer}, You: ${signer.address}`);
    }

    const amount = ethers.parseEther(taskArguments.amount);

    // Deliver tokens
    console.log("Delivering tokens...");
    const tx = await relayer.deliverTokens(taskArguments.recipient, taskArguments.token, amount);
    const receipt = await tx.wait();

    console.log("Tokens delivered!");
    console.log("Transaction hash:", receipt.hash);
  });

task("relayer:fees:collect")
  .addParam("token", "Token address to collect fees from")
  .addParam("recipient", "Recipient address for collected fees")
  .setDescription("Collect accumulated fees (owner only)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();

    console.log("Collecting fees...");
    console.log("Owner:", signer.address);
    console.log("Token:", taskArguments.token);
    console.log("Recipient:", taskArguments.recipient);

    const relayerDeployment = await deployments.get("Relayer");
    const relayer = await ethers.getContractAt("Relayer", relayerDeployment.address);

    const collectedFees = await relayer.getCollectedFees(taskArguments.token);
    console.log("Collected fees:", ethers.formatEther(collectedFees));

    if (collectedFees === 0n) {
      console.log("No fees to collect");
      return;
    }

    const tx = await relayer.collectFees(taskArguments.token, taskArguments.recipient);
    const receipt = await tx.wait();

    console.log("Fees collected!");
    console.log("Transaction hash:", receipt.hash);
  });

task("relayer:info")
  .setDescription("Get Relayer contract information")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    console.log("Relayer Contract Information");
    console.log("============================\n");

    const relayerDeployment = await deployments.get("Relayer");
    const relayer = await ethers.getContractAt("Relayer", relayerDeployment.address);

    console.log("Contract Address:", relayerDeployment.address);
    console.log("Owner:", await relayer.owner());
    console.log("Relayer:", await relayer.relayer());
    console.log("Fee Percentage:", (await relayer.feePercentage()).toString(), "basis points");
    console.log("Min Fee:", ethers.formatEther(await relayer.minFee()));
    console.log("Max Fee:", ethers.formatEther(await relayer.maxFee()));
    console.log("Bridge Nonce:", (await relayer.bridgeNonce()).toString());
    console.log("Solana Chain ID:", (await relayer.SOLANA_CHAIN_ID()).toString());
  });

export {};
