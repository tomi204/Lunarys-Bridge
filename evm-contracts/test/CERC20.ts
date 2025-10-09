import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

describe("ERC7984Example", function () {
  let token: any;
  let owner: any;
  let recipient: any;
  let other: any;

  const INITIAL_AMOUNT = 1000;
  const TRANSFER_AMOUNT = 100;

  beforeEach(async function () {
    [owner, recipient, other] = await ethers.getSigners();

    // Deploy ERC7984Example contract
    token = await ethers.deployContract("CERC20", [
      owner.address,
      INITIAL_AMOUNT,
      "Confidential Token",
      "CTKN",
      "https://example.com/token",
    ]);
  });

  describe("Initialization", function () {
    it("should set the correct name", async function () {
      expect(await token.name()).to.equal("Confidential Token");
    });

    it("should set the correct symbol", async function () {
      expect(await token.symbol()).to.equal("CTKN");
    });

    // it("should set the correct token URI", async function () {
    //   expect(await token.tokenURI()).to.equal("https://example.com/token");
    // });

    it("should mint initial amount to owner", async function () {
      // Verify that the owner has a balance (without decryption for now)
      const balanceHandle = await token.confidentialBalanceOf(owner.address);
      expect(balanceHandle).to.not.be.undefined;
    });
  });

  describe("Transfer Process", function () {
    it("should transfer tokens from owner to recipient", async function () {
      // Create encrypted input for transfer amount
      const encryptedInput = await fhevm
        .createEncryptedInput(await token.getAddress(), owner.address)
        .add64(TRANSFER_AMOUNT)
        .encrypt();

      // Perform the transfer
      await expect(
        token
          .connect(owner)
          [
            "confidentialTransfer(address,bytes32,bytes)"
          ](recipient.address, encryptedInput.handles[0], encryptedInput.inputProof),
      ).to.not.be.reverted;

      // Check that both addresses have balance handles (without decryption for now)
      const recipientBalanceHandle = await token.confidentialBalanceOf(recipient.address);
      const ownerBalanceHandle = await token.confidentialBalanceOf(owner.address);
      expect(recipientBalanceHandle).to.not.be.undefined;
      expect(ownerBalanceHandle).to.not.be.undefined;
    });

    it("should allow recipient to transfer received tokens", async function () {
      // First transfer from owner to recipient
      const encryptedInput1 = await fhevm
        .createEncryptedInput(await token.getAddress(), owner.address)
        .add64(TRANSFER_AMOUNT)
        .encrypt();

      await expect(
        token
          .connect(owner)
          [
            "confidentialTransfer(address,bytes32,bytes)"
          ](recipient.address, encryptedInput1.handles[0], encryptedInput1.inputProof),
      ).to.not.be.reverted;

      // Second transfer from recipient to other
      const encryptedInput2 = await fhevm
        .createEncryptedInput(await token.getAddress(), recipient.address)
        .add64(50) // Transfer half of what recipient received
        .encrypt();

      await expect(
        token
          .connect(recipient)
          [
            "confidentialTransfer(address,bytes32,bytes)"
          ](other.address, encryptedInput2.handles[0], encryptedInput2.inputProof),
      ).to.not.be.reverted;

      // Check that all addresses have balance handles (without decryption for now)
      const otherBalanceHandle = await token.confidentialBalanceOf(other.address);
      const recipientBalanceHandle = await token.confidentialBalanceOf(recipient.address);
      expect(otherBalanceHandle).to.not.be.undefined;
      expect(recipientBalanceHandle).to.not.be.undefined;
    });

    it("should revert when trying to transfer more than balance", async function () {
      const excessiveAmount = INITIAL_AMOUNT + 100;
      const encryptedInput = await fhevm
        .createEncryptedInput(await token.getAddress(), recipient.address)
        .add64(excessiveAmount)
        .encrypt();

      await expect(
        token
          .connect(recipient)
          [
            "confidentialTransfer(address,bytes32,bytes)"
          ](other.address, encryptedInput.handles[0], encryptedInput.inputProof),
      )
        .to.be.revertedWithCustomError(token, "ERC7984ZeroBalance")
        .withArgs(recipient.address);
    });

    it("should revert when transferring to zero address", async function () {
      const encryptedInput = await fhevm
        .createEncryptedInput(await token.getAddress(), owner.address)
        .add64(TRANSFER_AMOUNT)
        .encrypt();

      await expect(
        token
          .connect(owner)
          [
            "confidentialTransfer(address,bytes32,bytes)"
          ](ethers.ZeroAddress, encryptedInput.handles[0], encryptedInput.inputProof),
      )
        .to.be.revertedWithCustomError(token, "ERC7984InvalidReceiver")
        .withArgs(ethers.ZeroAddress);
    });
  });
});
