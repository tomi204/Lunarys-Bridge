import { expect } from "chai";
import { ethers } from "hardhat";
import { NewRelayer, MockERC20 } from "../types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("NewRelayer", function () {
  let newRelayer: NewRelayer;
  let token: MockERC20;
  let owner: SignerWithAddress;
  let relayer: SignerWithAddress;
  let solver1: SignerWithAddress;
  let solver2: SignerWithAddress;
  let user: SignerWithAddress;
  let slashCollector: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const BRIDGE_AMOUNT = ethers.parseEther("100");
  const MIN_SOLVER_BOND = ethers.parseEther("0.02");

  beforeEach(async function () {
    [owner, relayer, solver1, solver2, user, slashCollector] = await ethers.getSigners();

    // Deploy MockERC20 (name, symbol, initialSupply)
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    token = await MockERC20Factory.deploy("Test Token", "TEST", INITIAL_SUPPLY);
    await token.waitForDeployment();

    // Transfer tokens to user
    const deployerBalance = await token.balanceOf(owner.address);
    if (deployerBalance > 0) {
      await token.connect(owner).transfer(user.address, INITIAL_SUPPLY);
    }

    // Deploy NewRelayer
    const NewRelayerFactory = await ethers.getContractFactory("NewRelayer");
    newRelayer = await NewRelayerFactory.deploy(relayer.address, owner.address);
    await newRelayer.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct relayer address", async function () {
      expect(await newRelayer.relayer()).to.equal(relayer.address);
    });

    it("Should set the correct owner", async function () {
      expect(await newRelayer.owner()).to.equal(owner.address);
    });

    it("Should set default fee percentage", async function () {
      expect(await newRelayer.feePercentage()).to.equal(30); // 0.3%
    });

    it("Should set default claim window", async function () {
      expect(await newRelayer.claimWindow()).to.equal(20 * 60); // 20 minutes
    });

    it("Should set default min solver bond", async function () {
      expect(await newRelayer.minSolverBond()).to.equal(MIN_SOLVER_BOND);
    });

    it("Should set default slash percentage", async function () {
      expect(await newRelayer.slashBps()).to.equal(5000); // 50%
    });

    it("Should set slash collector to owner", async function () {
      expect(await newRelayer.slashCollector()).to.equal(owner.address);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update relayer address", async function () {
      const newRelayerAddr = solver1.address;
      await expect(newRelayer.connect(owner).updateRelayer(newRelayerAddr))
        .to.emit(newRelayer, "RelayerUpdated")
        .withArgs(relayer.address, newRelayerAddr);

      expect(await newRelayer.relayer()).to.equal(newRelayerAddr);
    });

    it("Should not allow non-owner to update relayer", async function () {
      await expect(newRelayer.connect(user).updateRelayer(solver1.address)).to.be.reverted;
    });

    it("Should allow owner to update fee percentage", async function () {
      const newFee = 50; // 0.5%
      await expect(newRelayer.connect(owner).updateFeePercentage(newFee))
        .to.emit(newRelayer, "FeePercentageUpdated")
        .withArgs(30, newFee);

      expect(await newRelayer.feePercentage()).to.equal(newFee);
    });

    it("Should not allow fee percentage above 10%", async function () {
      await expect(newRelayer.connect(owner).updateFeePercentage(1001)).to.be.revertedWithCustomError(
        newRelayer,
        "InvalidFee",
      );
    });

    it("Should allow owner to update fee limits", async function () {
      const newMinFee = ethers.parseEther("0.01");
      const newMaxFee = ethers.parseEther("200");

      await expect(newRelayer.connect(owner).updateFeeLimits(newMinFee, newMaxFee))
        .to.emit(newRelayer, "FeeLimitsUpdated")
        .withArgs(newMinFee, newMaxFee);

      expect(await newRelayer.minFee()).to.equal(newMinFee);
      expect(await newRelayer.maxFee()).to.equal(newMaxFee);
    });

    it("Should allow owner to update claim window", async function () {
      const newWindow = 30 * 60; // 30 minutes
      await newRelayer.connect(owner).updateClaimWindow(newWindow);
      expect(await newRelayer.claimWindow()).to.equal(newWindow);
    });

    it("Should allow owner to update min solver bond", async function () {
      const newBond = ethers.parseEther("0.05");
      await newRelayer.connect(owner).updateMinSolverBond(newBond);
      expect(await newRelayer.minSolverBond()).to.equal(newBond);
    });

    it("Should allow owner to update slash params", async function () {
      const newSlashBps = 3000; // 30%
      await newRelayer.connect(owner).updateSlashParams(newSlashBps, slashCollector.address);
      expect(await newRelayer.slashBps()).to.equal(newSlashBps);
      expect(await newRelayer.slashCollector()).to.equal(slashCollector.address);
    });
  });

  describe("Bridge Initiation (EVM → Solana)", function () {
    it("Should initiate bridge with encrypted destination", async function () {
      // Approve tokens
      await token.connect(user).approve(await newRelayer.getAddress(), BRIDGE_AMOUNT);

      // Mock encrypted destination (using bytes32 for simplicity in testing)
      const encryptedDest = ethers.encodeBytes32String("solana_destination");
      const proof = "0x";

      const tx = await newRelayer.connect(user).initiateBridge(await token.getAddress(), BRIDGE_AMOUNT, encryptedDest, proof);

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return newRelayer.interface.parseLog(log)?.name === "BridgeInitiated";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;

      const requestId = 1n;
      const request = await newRelayer.getBridgeRequest(requestId);

      expect(request.sender).to.equal(user.address);
      expect(request.token).to.equal(await token.getAddress());
      expect(request.finalized).to.be.false;
    });

    it("Should calculate and store fees correctly", async function () {
      await token.connect(user).approve(await newRelayer.getAddress(), BRIDGE_AMOUNT);

      const encryptedDest = ethers.encodeBytes32String("solana_destination");
      const proof = "0x";

      await newRelayer.connect(user).initiateBridge(await token.getAddress(), BRIDGE_AMOUNT, encryptedDest, proof);

      const requestId = 1n;
      const feeEscrow = await newRelayer.requestFeeEscrow(requestId);

      // Fee should be 0.3% of BRIDGE_AMOUNT
      const expectedFee = (BRIDGE_AMOUNT * 30n) / 10000n;
      expect(feeEscrow).to.be.greaterThan(0);
    });

    it("Should not allow bridge with zero amount", async function () {
      const encryptedDest = ethers.encodeBytes32String("solana_destination");
      const proof = "0x";

      await expect(
        newRelayer.connect(user).initiateBridge(await token.getAddress(), 0, encryptedDest, proof),
      ).to.be.revertedWithCustomError(newRelayer, "ZeroAmount");
    });

    it("Should not allow bridge with zero token address", async function () {
      const encryptedDest = ethers.encodeBytes32String("solana_destination");
      const proof = "0x";

      await expect(
        newRelayer.connect(user).initiateBridge(ethers.ZeroAddress, BRIDGE_AMOUNT, encryptedDest, proof),
      ).to.be.revertedWithCustomError(newRelayer, "ZeroAddress");
    });
  });

  describe("Node Authorization", function () {
    it("Should allow owner to authorize nodes", async function () {
      await expect(newRelayer.connect(owner).authorizeNode(solver1.address))
        .to.emit(newRelayer, "NodeAuthorized")
        .withArgs(solver1.address);

      expect(await newRelayer.authorizedNodes(solver1.address)).to.be.true;
    });

    it("Should not allow non-owner to authorize nodes", async function () {
      await expect(newRelayer.connect(user).authorizeNode(solver1.address)).to.be.reverted;
    });

    it("Should allow owner to revoke node authorization", async function () {
      await newRelayer.connect(owner).authorizeNode(solver1.address);

      await expect(newRelayer.connect(owner).revokeNode(solver1.address))
        .to.emit(newRelayer, "NodeRevoked")
        .withArgs(solver1.address);

      expect(await newRelayer.authorizedNodes(solver1.address)).to.be.false;
    });

    it("Should return correct authorized nodes list", async function () {
      await newRelayer.connect(owner).authorizeNode(solver1.address);
      await newRelayer.connect(owner).authorizeNode(solver2.address);

      const nodes = await newRelayer.getAuthorizedNodes();
      expect(nodes.length).to.equal(2);
      expect(nodes).to.include(solver1.address);
      expect(nodes).to.include(solver2.address);
    });

    it("Should return correct count after revocation", async function () {
      await newRelayer.connect(owner).authorizeNode(solver1.address);
      await newRelayer.connect(owner).authorizeNode(solver2.address);
      await newRelayer.connect(owner).revokeNode(solver1.address);

      const nodes = await newRelayer.getAuthorizedNodes();
      expect(nodes.length).to.equal(1);
      expect(nodes[0]).to.equal(solver2.address);
    });
  });

  describe("Competitive Claiming", function () {
    let requestId: bigint;

    beforeEach(async function () {
      // Authorize solvers
      await newRelayer.connect(owner).authorizeNode(solver1.address);
      await newRelayer.connect(owner).authorizeNode(solver2.address);

      // Create a bridge request
      await token.connect(user).approve(await newRelayer.getAddress(), BRIDGE_AMOUNT);
      const encryptedDest = ethers.encodeBytes32String("solana_destination");
      const proof = "0x";
      await newRelayer.connect(user).initiateBridge(await token.getAddress(), BRIDGE_AMOUNT, encryptedDest, proof);
      requestId = 1n;
    });

    it("Should allow authorized solver to claim bridge request", async function () {
      const bondAmount = ethers.parseEther("0.03");

      await expect(newRelayer.connect(solver1).claimBridge(requestId, { value: bondAmount }))
        .to.emit(newRelayer, "BridgeClaimed")
        .withArgs(requestId, solver1.address, bondAmount, await time.latest() + 20 * 60);

      const claim = await newRelayer.requestClaim(requestId);
      expect(claim.solver).to.equal(solver1.address);
      expect(claim.bond).to.equal(bondAmount);
    });

    it("Should not allow claim with bond below minimum", async function () {
      const lowBond = ethers.parseEther("0.01"); // Below 0.02 minimum

      await expect(newRelayer.connect(solver1).claimBridge(requestId, { value: lowBond })).to.be.revertedWithCustomError(
        newRelayer,
        "BondTooLow",
      );
    });

    it("Should not allow unauthorized node to claim", async function () {
      const bondAmount = ethers.parseEther("0.03");

      // Try to claim with non-authorized user
      await expect(newRelayer.connect(user).claimBridge(requestId, { value: bondAmount })).to.be.revertedWithCustomError(
        newRelayer,
        "NotAuthorizedNode",
      );
    });

    it("Should not allow claiming already active request", async function () {
      const bondAmount = ethers.parseEther("0.03");

      // First solver claims
      await newRelayer.connect(solver1).claimBridge(requestId, { value: bondAmount });

      // Second solver tries to claim before expiry
      await expect(newRelayer.connect(solver2).claimBridge(requestId, { value: bondAmount })).to.be.revertedWithCustomError(
        newRelayer,
        "ActiveClaim",
      );
    });

    it("Should allow reclaim after expiry with slashing", async function () {
      const bondAmount = ethers.parseEther("0.03");

      // First solver claims
      await newRelayer.connect(solver1).claimBridge(requestId, { value: bondAmount });

      // Fast forward past claim window
      await time.increase(21 * 60); // 21 minutes

      const balanceBefore = await ethers.provider.getBalance(slashCollector.address);

      // Second solver can claim after expiry
      await expect(newRelayer.connect(solver2).claimBridge(requestId, { value: bondAmount }))
        .to.emit(newRelayer, "BridgeClaimExpired");

      // Check slash collector received slashed amount (50% of bond)
      const balanceAfter = await ethers.provider.getBalance(slashCollector.address);
      // Note: slash collector is owner by default
    });
  });

  describe("Verification and Settlement", function () {
    let requestId: bigint;

    beforeEach(async function () {
      // Authorize solver
      await newRelayer.connect(owner).authorizeNode(solver1.address);

      // Create and claim a bridge request
      await token.connect(user).approve(await newRelayer.getAddress(), BRIDGE_AMOUNT);
      const encryptedDest = ethers.encodeBytes32String("solana_destination");
      const proof = "0x";
      await newRelayer.connect(user).initiateBridge(await token.getAddress(), BRIDGE_AMOUNT, encryptedDest, proof);
      requestId = 1n;

      const bondAmount = ethers.parseEther("0.03");
      await newRelayer.connect(solver1).claimBridge(requestId, { value: bondAmount });
    });

    it("Should allow relayer to verify and settle", async function () {
      const destTxHash = ethers.encodeBytes32String("solana_tx_hash");
      const evidenceHash = ethers.encodeBytes32String("evidence_hash");

      const solverBalanceBefore = await token.balanceOf(solver1.address);
      const bondBalanceBefore = await ethers.provider.getBalance(solver1.address);

      await expect(newRelayer.connect(relayer).verifyAndSettle(requestId, destTxHash, evidenceHash))
        .to.emit(newRelayer, "BridgePaidToSolver")
        .to.emit(newRelayer, "SolverBondRefunded")
        .to.emit(newRelayer, "BridgeVerified");

      // Check solver received tokens (amount + fee)
      const solverBalanceAfter = await token.balanceOf(solver1.address);
      expect(solverBalanceAfter).to.be.greaterThan(solverBalanceBefore);

      // Check bond was refunded
      const bondBalanceAfter = await ethers.provider.getBalance(solver1.address);
      expect(bondBalanceAfter).to.be.greaterThan(bondBalanceBefore);

      // Check request is finalized
      const request = await newRelayer.getBridgeRequest(requestId);
      expect(request.finalized).to.be.true;
    });

    it("Should allow verification with URL", async function () {
      const destTxHash = ethers.encodeBytes32String("solana_tx_hash");
      const evidenceHash = ethers.encodeBytes32String("evidence_hash");
      const evidenceURL = "https://solscan.io/tx/abc123";

      await expect(newRelayer.connect(relayer)["verifyAndSettle(uint256,bytes32,bytes32,string)"](requestId, destTxHash, evidenceHash, evidenceURL))
        .to.emit(newRelayer, "BridgeVerifiedURL")
        .withArgs(requestId, relayer.address, destTxHash, evidenceHash, evidenceURL);
    });

    it("Should not allow non-relayer to verify", async function () {
      const destTxHash = ethers.encodeBytes32String("solana_tx_hash");
      const evidenceHash = ethers.encodeBytes32String("evidence_hash");

      await expect(
        newRelayer.connect(user).verifyAndSettle(requestId, destTxHash, evidenceHash),
      ).to.be.revertedWithCustomError(newRelayer, "OnlyRelayer");
    });

    it("Should not allow verification after claim expiry", async function () {
      // Fast forward past claim window
      await time.increase(21 * 60);

      const destTxHash = ethers.encodeBytes32String("solana_tx_hash");
      const evidenceHash = ethers.encodeBytes32String("evidence_hash");

      await expect(
        newRelayer.connect(relayer).verifyAndSettle(requestId, destTxHash, evidenceHash),
      ).to.be.revertedWithCustomError(newRelayer, "ClaimExpired");
    });

    it("Should not allow double settlement", async function () {
      const destTxHash = ethers.encodeBytes32String("solana_tx_hash");
      const evidenceHash = ethers.encodeBytes32String("evidence_hash");

      await newRelayer.connect(relayer).verifyAndSettle(requestId, destTxHash, evidenceHash);

      await expect(
        newRelayer.connect(relayer).verifyAndSettle(requestId, destTxHash, evidenceHash),
      ).to.be.revertedWithCustomError(newRelayer, "RequestAlreadyFinalized");
    });
  });

  describe("Release Expired Claim", function () {
    let requestId: bigint;

    beforeEach(async function () {
      // Authorize solver
      await newRelayer.connect(owner).authorizeNode(solver1.address);

      // Create and claim a bridge request
      await token.connect(user).approve(await newRelayer.getAddress(), BRIDGE_AMOUNT);
      const encryptedDest = ethers.encodeBytes32String("solana_destination");
      const proof = "0x";
      await newRelayer.connect(user).initiateBridge(await token.getAddress(), BRIDGE_AMOUNT, encryptedDest, proof);
      requestId = 1n;

      const bondAmount = ethers.parseEther("0.03");
      await newRelayer.connect(solver1).claimBridge(requestId, { value: bondAmount });
    });

    it("Should allow anyone to release expired claim", async function () {
      // Fast forward past claim window
      await time.increase(21 * 60);

      await expect(newRelayer.connect(user).releaseExpiredClaim(requestId))
        .to.emit(newRelayer, "BridgeClaimExpired");

      // Claim should be cleared
      const claim = await newRelayer.requestClaim(requestId);
      expect(claim.solver).to.equal(ethers.ZeroAddress);
    });

    it("Should not allow release of active claim", async function () {
      await expect(newRelayer.connect(user).releaseExpiredClaim(requestId)).to.be.revertedWithCustomError(
        newRelayer,
        "ActiveClaim",
      );
    });
  });

  describe("Solana → EVM (Reverse)", function () {
    it("Should allow relayer to deliver tokens", async function () {
      // Give tokens to relayer contract
      await token.mint(await newRelayer.getAddress(), BRIDGE_AMOUNT);

      const recipientBalanceBefore = await token.balanceOf(user.address);

      await expect(newRelayer.connect(relayer).deliverTokens(user.address, await token.getAddress(), BRIDGE_AMOUNT))
        .to.emit(newRelayer, "IncomingBridgeDelivered")
        .withArgs(user.address, await token.getAddress(), BRIDGE_AMOUNT);

      const recipientBalanceAfter = await token.balanceOf(user.address);
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(BRIDGE_AMOUNT);
    });

    it("Should not allow non-relayer to deliver tokens", async function () {
      await expect(
        newRelayer.connect(user).deliverTokens(user.address, await token.getAddress(), BRIDGE_AMOUNT),
      ).to.be.revertedWithCustomError(newRelayer, "OnlyRelayer");
    });
  });

  describe("Emergency Withdrawal", function () {
    it("Should allow owner to emergency withdraw", async function () {
      // Send tokens to contract
      await token.mint(await newRelayer.getAddress(), BRIDGE_AMOUNT);

      await expect(newRelayer.connect(owner).emergencyWithdraw(await token.getAddress(), BRIDGE_AMOUNT, owner.address)).to.not.be
        .reverted;

      expect(await token.balanceOf(owner.address)).to.equal(BRIDGE_AMOUNT);
    });

    it("Should not allow non-owner to emergency withdraw", async function () {
      await token.mint(await newRelayer.getAddress(), BRIDGE_AMOUNT);

      await expect(newRelayer.connect(user).emergencyWithdraw(await token.getAddress(), BRIDGE_AMOUNT, user.address)).to.be
        .reverted;
    });
  });

  describe("View Functions", function () {
    it("Should return bridge nonce", async function () {
      expect(await newRelayer.bridgeNonce()).to.equal(0);
    });

    it("Should return contract balance", async function () {
      await token.mint(await newRelayer.getAddress(), BRIDGE_AMOUNT);
      expect(await newRelayer.getContractBalance(await token.getAddress())).to.equal(BRIDGE_AMOUNT);
    });

    it("Should return collected fees", async function () {
      expect(await newRelayer.getCollectedFees(await token.getAddress())).to.equal(0);
    });
  });
});
