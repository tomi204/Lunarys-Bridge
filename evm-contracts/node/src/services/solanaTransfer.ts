import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { NodeConfig, SolanaTransferResult } from "../types";
import bs58 from "bs58";

export class SolanaTransferService {
  private connection: Connection;
  private wallet: Keypair;
  private config: NodeConfig;

  constructor(config: NodeConfig) {
    this.config = config;
    this.connection = new Connection(config.solanaRpcUrl, "confirmed");

    // Parse the Solana private key
    // Assuming the private key is in base58 format
    const secretKey = bs58.decode(config.solanaPrivateKey);
    this.wallet = Keypair.fromSecretKey(secretKey);

    console.log(`Solana wallet initialized: ${this.wallet.publicKey.toBase58()}`);
  }

  /**
   * Transfer SOL to a Solana address
   * @param destinationAddress The recipient's Solana address (base58 string)
   * @param amount The amount in lamports (1 SOL = 1e9 lamports)
   */
  async transferSOL(destinationAddress: string, amount: bigint): Promise<SolanaTransferResult> {
    try {
      console.log("\n=================================");
      console.log("Initiating Solana SOL Transfer");
      console.log("=================================");
      console.log(`From: ${this.wallet.publicKey.toBase58()}`);
      console.log(`To: ${destinationAddress}`);
      console.log(`Amount: ${Number(amount) / LAMPORTS_PER_SOL} SOL`);
      console.log("=================================\n");

      const destination = new PublicKey(destinationAddress);

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: destination,
          lamports: Number(amount),
        })
      );

      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(this.connection, transaction, [this.wallet], {
        commitment: "confirmed",
      });

      console.log(`✓ SOL transfer successful!`);
      console.log(`Signature: ${signature}`);
      console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

      return {
        signature,
        success: true,
      };
    } catch (error) {
      console.error("Error transferring SOL:", error);
      return {
        signature: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Transfer SPL tokens to a Solana address
   * @param tokenMintAddress The SPL token mint address
   * @param destinationAddress The recipient's Solana address
   * @param amount The amount of tokens (in smallest unit)
   */
  async transferSPLToken(
    tokenMintAddress: string,
    destinationAddress: string,
    amount: bigint
  ): Promise<SolanaTransferResult> {
    try {
      console.log("\n=================================");
      console.log("Initiating Solana SPL Token Transfer");
      console.log("=================================");
      console.log(`Token Mint: ${tokenMintAddress}`);
      console.log(`From: ${this.wallet.publicKey.toBase58()}`);
      console.log(`To: ${destinationAddress}`);
      console.log(`Amount: ${amount.toString()}`);
      console.log("=================================\n");

      const mintPublicKey = new PublicKey(tokenMintAddress);
      const destinationPublicKey = new PublicKey(destinationAddress);

      // Get or create the source token account
      const token = new Token(this.connection, mintPublicKey, TOKEN_PROGRAM_ID, this.wallet);

      // Get source token account
      const sourceAccount = await token.getOrCreateAssociatedAccountInfo(this.wallet.publicKey);

      // Get or create destination token account
      const destinationAccount = await token.getOrCreateAssociatedAccountInfo(destinationPublicKey);

      console.log(`Source token account: ${sourceAccount.address.toBase58()}`);
      console.log(`Destination token account: ${destinationAccount.address.toBase58()}`);

      // Transfer tokens
      const signature = await token.transfer(
        sourceAccount.address,
        destinationAccount.address,
        this.wallet.publicKey,
        [],
        Number(amount)
      );

      console.log(`✓ SPL token transfer successful!`);
      console.log(`Signature: ${signature}`);
      console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

      return {
        signature,
        success: true,
      };
    } catch (error) {
      console.error("Error transferring SPL token:", error);
      return {
        signature: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get the Solana wallet public key
   */
  getWalletAddress(): string {
    return this.wallet.publicKey.toBase58();
  }

  /**
   * Get SOL balance
   */
  async getBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Get SPL token balance
   */
  async getTokenBalance(tokenMintAddress: string): Promise<number> {
    try {
      const mintPublicKey = new PublicKey(tokenMintAddress);
      const token = new Token(this.connection, mintPublicKey, TOKEN_PROGRAM_ID, this.wallet);
      const tokenAccount = await token.getOrCreateAssociatedAccountInfo(this.wallet.publicKey);
      return Number(tokenAccount.amount);
    } catch (error) {
      console.error("Error getting token balance:", error);
      return 0;
    }
  }
}
