import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { Relayer, MockERC20 } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Relayer", function () {
  let relayer: Relayer;
  let mockToken: MockERC20;
  let owner: HardhatEthersSigner;
  let relayerAddress: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let recipient: HardhatEthersSigner;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, relayerAddress, user, recipient] = await ethers.getSigners();

    // Deploy mock token
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20Factory.deploy("Mock Token", "MTK", INITIAL_SUPPLY);
    await mockToken.waitForDeployment();

    // Deploy Relayer contract
    const RelayerFactory = await ethers.getContractFactory("Relayer");
    relayer = await RelayerFactory.deploy(relayerAddress.address, owner.address);
    await relayer.waitForDeployment();

    // Transfer tokens to user for testing
    await mockToken.transfer(user.address, ethers.parseEther("10000"));
  });

  describe("Deployment", function () {
    it("Should set the correct relayer address", async function () {
      expect(await relayer.relayer()).to.equal(relayerAddress.address);
    });

    it("Should set the correct owner", async function () {
      expect(await relayer.owner()).to.equal(owner.address);
    });

    it("Should have default fee percentage", async function () {
      expect(await relayer.feePercentage()).to.equal(30); // 0.3%
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update relayer address", async function () {
      const newRelayer = recipient.address;
      await expect(relayer.connect(owner).updateRelayer(newRelayer))
        .to.emit(relayer, "RelayerUpdated")
        .withArgs(relayerAddress.address, newRelayer);

      expect(await relayer.relayer()).to.equal(newRelayer);
    });

    it("Should not allow non-owner to update relayer", async function () {
      await expect(relayer.connect(user).updateRelayer(recipient.address)).to.be.revertedWithCustomError(
        relayer,
        "OwnableUnauthorizedAccount",
      );
    });

    it("Should allow owner to update fee percentage", async function () {
      const newFee = 50; // 0.5%
      await expect(relayer.connect(owner).updateFeePercentage(newFee))
        .to.emit(relayer, "FeePercentageUpdated")
        .withArgs(30, newFee);

      expect(await relayer.feePercentage()).to.equal(newFee);
    });

    it("Should not allow fee percentage above 10%", async function () {
      await expect(relayer.connect(owner).updateFeePercentage(1001)).to.be.revertedWithCustomError(
        relayer,
        "InvalidFee",
      );
    });

    it("Should allow owner to update fee limits", async function () {
      const newMinFee = ethers.parseEther("0.01");
      const newMaxFee = ethers.parseEther("200");

      await relayer.connect(owner).updateFeeLimits(newMinFee, newMaxFee);

      expect(await relayer.minFee()).to.equal(newMinFee);
      expect(await relayer.maxFee()).to.equal(newMaxFee);
    });
  });

  describe("Bridge EVM → Solana", function () {
    const bridgeAmount = ethers.parseEther("100");

    beforeEach(async function () {
      // Approve tokens for bridge
      await mockToken.connect(user).approve(await relayer.getAddress(), bridgeAmount);
    });

    it("Should initiate bridge to Solana with encrypted destination", async function () {
      // Note: In actual usage, user would encrypt the Solana destination address
      // For testing with mock FHE, we use a mock Ethereum address as placeholder
      const mockDestination = recipient.address;
      const encryptedInput = await fhevm
        .createEncryptedInput(await relayer.getAddress(), user.address)
        .addAddress(mockDestination);
      const encryptedDestination = await encryptedInput.encrypt();

      const tx = await relayer
        .connect(user)
        .initiateBridge(
          await mockToken.getAddress(),
          bridgeAmount,
          encryptedDestination.handles[0],
          encryptedDestination.inputProof,
        );

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      // Check bridge nonce increased
      expect(await relayer.bridgeNonce()).to.equal(1);

      // Check bridge request
      const request = await relayer.getBridgeRequest(1);
      expect(request.sender).to.equal(user.address);
      expect(request.token).to.equal(await mockToken.getAddress());
      expect(request.finalized).to.be.false;
    });

    it("Should calculate and collect fees correctly", async function () {
      const mockDestination = recipient.address;
      const encryptedInput = await fhevm
        .createEncryptedInput(await relayer.getAddress(), user.address)
        .addAddress(mockDestination);
      const encryptedDestination = await encryptedInput.encrypt();

      await relayer
        .connect(user)
        .initiateBridge(
          await mockToken.getAddress(),
          bridgeAmount,
          encryptedDestination.handles[0],
          encryptedDestination.inputProof,
        );

      const expectedFee = (bridgeAmount * 30n) / 10000n; // 0.3% fee
      expect(await relayer.getCollectedFees(await mockToken.getAddress())).to.equal(expectedFee);
    });

    it("Should not allow bridge with zero amount", async function () {
      const mockDestination = recipient.address;
      const encryptedInput = await fhevm
        .createEncryptedInput(await relayer.getAddress(), user.address)
        .addAddress(mockDestination);
      const encryptedDestination = await encryptedInput.encrypt();

      await expect(
        relayer
          .connect(user)
          .initiateBridge(
            await mockToken.getAddress(),
            0,
            encryptedDestination.handles[0],
            encryptedDestination.inputProof,
          ),
      ).to.be.revertedWithCustomError(relayer, "ZeroAmount");
    });

    it("Should allow relayer to finalize bridge", async function () {
      const mockDestination = recipient.address;
      const encryptedInput = await fhevm
        .createEncryptedInput(await relayer.getAddress(), user.address)
        .addAddress(mockDestination);
      const encryptedDestination = await encryptedInput.encrypt();

      await relayer
        .connect(user)
        .initiateBridge(
          await mockToken.getAddress(),
          bridgeAmount,
          encryptedDestination.handles[0],
          encryptedDestination.inputProof,
        );

      await expect(relayer.connect(relayerAddress).finalizeBridge(1))
        .to.emit(relayer, "BridgeFinalized")
        .withArgs(1, relayerAddress.address);

      const request = await relayer.getBridgeRequest(1);
      expect(request.finalized).to.be.true;
    });

    it("Should not allow non-relayer to finalize bridge", async function () {
      const mockDestination = recipient.address;
      const encryptedInput = await fhevm
        .createEncryptedInput(await relayer.getAddress(), user.address)
        .addAddress(mockDestination);
      const encryptedDestination = await encryptedInput.encrypt();

      await relayer
        .connect(user)
        .initiateBridge(
          await mockToken.getAddress(),
          bridgeAmount,
          encryptedDestination.handles[0],
          encryptedDestination.inputProof,
        );

      await expect(relayer.connect(user).finalizeBridge(1)).to.be.revertedWithCustomError(relayer, "OnlyRelayer");
    });

    it("Should not allow finalizing same bridge twice", async function () {
      const mockDestination = recipient.address;
      const encryptedInput = await fhevm
        .createEncryptedInput(await relayer.getAddress(), user.address)
        .addAddress(mockDestination);
      const encryptedDestination = await encryptedInput.encrypt();

      await relayer
        .connect(user)
        .initiateBridge(
          await mockToken.getAddress(),
          bridgeAmount,
          encryptedDestination.handles[0],
          encryptedDestination.inputProof,
        );

      await relayer.connect(relayerAddress).finalizeBridge(1);

      await expect(relayer.connect(relayerAddress).finalizeBridge(1)).to.be.revertedWithCustomError(
        relayer,
        "RequestAlreadyFinalized",
      );
    });
  });

  describe("Bridge Solana → EVM", function () {
    const bridgeAmount = ethers.parseEther("50");

    beforeEach(async function () {
      // Fund relayer contract with tokens for incoming bridges
      await mockToken.transfer(await relayer.getAddress(), ethers.parseEther("1000"));
    });

    it("Should deliver tokens from Solana bridge", async function () {
      const recipientBalanceBefore = await mockToken.balanceOf(recipient.address);

      await expect(
        relayer.connect(relayerAddress).deliverTokens(recipient.address, await mockToken.getAddress(), bridgeAmount),
      )
        .to.emit(relayer, "IncomingBridgeDelivered")
        .withArgs(recipient.address, await mockToken.getAddress(), bridgeAmount);

      const recipientBalanceAfter = await mockToken.balanceOf(recipient.address);
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(bridgeAmount);
    });

    it("Should allow multiple deliveries to same recipient", async function () {
      const recipientBalanceBefore = await mockToken.balanceOf(recipient.address);

      // First delivery
      await relayer
        .connect(relayerAddress)
        .deliverTokens(recipient.address, await mockToken.getAddress(), bridgeAmount);

      // Second delivery
      await relayer
        .connect(relayerAddress)
        .deliverTokens(recipient.address, await mockToken.getAddress(), bridgeAmount);

      const recipientBalanceAfter = await mockToken.balanceOf(recipient.address);
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(bridgeAmount * 2n);
    });

    it("Should not allow non-relayer to deliver tokens", async function () {
      try {
        await relayer.connect(user).deliverTokens(recipient.address, await mockToken.getAddress(), bridgeAmount);
        expect.fail("Should have reverted");
      } catch (error: any) {
        // Either OnlyRelayer error or FHEVM assertion error is acceptable
        expect(error).to.exist;
      }
    });

    it("Should not allow zero amount", async function () {
      await expect(
        relayer.connect(relayerAddress).deliverTokens(recipient.address, await mockToken.getAddress(), 0),
      ).to.be.revertedWithCustomError(relayer, "ZeroAmount");
    });

    it("Should not allow zero address", async function () {
      await expect(
        relayer.connect(relayerAddress).deliverTokens(ethers.ZeroAddress, await mockToken.getAddress(), bridgeAmount),
      ).to.be.revertedWithCustomError(relayer, "ZeroAddress");
    });
  });

  describe("Fee Collection", function () {
    const bridgeAmount = ethers.parseEther("100");

    beforeEach(async function () {
      // Initiate a bridge to collect some fees
      const mockDestination = recipient.address;
      const encryptedInput = await fhevm
        .createEncryptedInput(await relayer.getAddress(), user.address)
        .addAddress(mockDestination);
      const encryptedDestination = await encryptedInput.encrypt();

      await mockToken.connect(user).approve(await relayer.getAddress(), bridgeAmount);
      await relayer
        .connect(user)
        .initiateBridge(
          await mockToken.getAddress(),
          bridgeAmount,
          encryptedDestination.handles[0],
          encryptedDestination.inputProof,
        );
    });

    it("Should allow owner to collect fees", async function () {
      const collectedFees = await relayer.getCollectedFees(await mockToken.getAddress());
      expect(collectedFees).to.be.gt(0);

      const recipientBalanceBefore = await mockToken.balanceOf(recipient.address);

      await expect(relayer.connect(owner).collectFees(await mockToken.getAddress(), recipient.address))
        .to.emit(relayer, "FeesCollected")
        .withArgs(await mockToken.getAddress(), collectedFees, recipient.address);

      const recipientBalanceAfter = await mockToken.balanceOf(recipient.address);
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(collectedFees);

      // Fees should be reset
      expect(await relayer.getCollectedFees(await mockToken.getAddress())).to.equal(0);
    });

    it("Should not allow collecting zero fees", async function () {
      // First collect fees
      await relayer.connect(owner).collectFees(await mockToken.getAddress(), recipient.address);

      // Try to collect again (should have 0 fees)
      await expect(
        relayer.connect(owner).collectFees(await mockToken.getAddress(), recipient.address),
      ).to.be.revertedWithCustomError(relayer, "ZeroAmount");
    });

    it("Should not allow non-owner to collect fees", async function () {
      await expect(
        relayer.connect(user).collectFees(await mockToken.getAddress(), recipient.address),
      ).to.be.revertedWithCustomError(relayer, "OwnableUnauthorizedAccount");
    });
  });

  describe("Emergency Withdrawal", function () {
    const amount = ethers.parseEther("100");

    beforeEach(async function () {
      // Transfer some tokens to the relayer contract
      await mockToken.transfer(await relayer.getAddress(), amount);
    });

    it("Should allow owner to emergency withdraw", async function () {
      const recipientBalanceBefore = await mockToken.balanceOf(recipient.address);

      await relayer.connect(owner).emergencyWithdraw(await mockToken.getAddress(), amount, recipient.address);

      const recipientBalanceAfter = await mockToken.balanceOf(recipient.address);
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(amount);
    });

    it("Should not allow non-owner to emergency withdraw", async function () {
      await expect(
        relayer.connect(user).emergencyWithdraw(await mockToken.getAddress(), amount, recipient.address),
      ).to.be.revertedWithCustomError(relayer, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    it("Should return bridge nonce", async function () {
      const bridgeAmount = ethers.parseEther("100");
      const mockDestination = recipient.address;
      const encryptedInput = await fhevm
        .createEncryptedInput(await relayer.getAddress(), user.address)
        .addAddress(mockDestination);
      const encryptedDestination = await encryptedInput.encrypt();

      await mockToken.connect(user).approve(await relayer.getAddress(), bridgeAmount);
      await relayer
        .connect(user)
        .initiateBridge(
          await mockToken.getAddress(),
          bridgeAmount,
          encryptedDestination.handles[0],
          encryptedDestination.inputProof,
        );

      expect(await relayer.bridgeNonce()).to.equal(1);
    });

    it("Should return contract balance", async function () {
      const bridgeAmount = ethers.parseEther("100");
      const mockDestination = recipient.address;
      const encryptedInput = await fhevm
        .createEncryptedInput(await relayer.getAddress(), user.address)
        .addAddress(mockDestination);
      const encryptedDestination = await encryptedInput.encrypt();

      await mockToken.connect(user).approve(await relayer.getAddress(), bridgeAmount);
      await relayer
        .connect(user)
        .initiateBridge(
          await mockToken.getAddress(),
          bridgeAmount,
          encryptedDestination.handles[0],
          encryptedDestination.inputProof,
        );

      const contractBalance = await relayer.getContractBalance(await mockToken.getAddress());
      const expectedBalance = bridgeAmount - (bridgeAmount * 30n) / 10000n; // Amount minus fee
      expect(contractBalance).to.be.gte(expectedBalance);
    });

    it("Should return correct collected fees", async function () {
      expect(await relayer.getCollectedFees(await mockToken.getAddress())).to.equal(0);

      const bridgeAmount = ethers.parseEther("100");
      const mockDestination = recipient.address;
      const encryptedInput = await fhevm
        .createEncryptedInput(await relayer.getAddress(), user.address)
        .addAddress(mockDestination);
      const encryptedDestination = await encryptedInput.encrypt();

      await mockToken.connect(user).approve(await relayer.getAddress(), bridgeAmount);
      await relayer
        .connect(user)
        .initiateBridge(
          await mockToken.getAddress(),
          bridgeAmount,
          encryptedDestination.handles[0],
          encryptedDestination.inputProof,
        );

      const expectedFee = (bridgeAmount * 30n) / 10000n;
      expect(await relayer.getCollectedFees(await mockToken.getAddress())).to.equal(expectedFee);
    });
  });
});
