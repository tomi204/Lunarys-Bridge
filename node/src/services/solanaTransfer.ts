import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { NodeConfig, SolanaTransferResult } from "../types";
import bs58 from "bs58";

export class SolanaTransferService {
  private connection: Connection;
  private wallet: Keypair;

  constructor(config: NodeConfig) {
    this.connection = new Connection(config.solanaRpcUrl, "confirmed");

    // Parse the Solana private key - supports both JSON array and base58 format
    const secretKey = this.parsePrivateKey(config.solanaPrivateKey);
    this.wallet = Keypair.fromSecretKey(secretKey);

    console.log(
      `Solana wallet initialized: ${this.wallet.publicKey.toBase58()}`
    );
  }

  /**
   * Parse Solana private key from either JSON array format or base58 format
   * @param privateKey - Either "[1,2,3,...]" or "base58string"
   * @returns Uint8Array of the private key
   */
  private parsePrivateKey(privateKey: string): Uint8Array {
    const trimmed = privateKey.trim();

    // Check if it's a JSON array format [1,2,3,...]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const keyArray = JSON.parse(trimmed);

        if (!Array.isArray(keyArray)) {
          throw new Error('Private key JSON must be an array');
        }

        if (keyArray.length !== 64) {
          throw new Error(`Invalid keypair length: expected 64 bytes, got ${keyArray.length}`);
        }

        return Uint8Array.from(keyArray);
      } catch (error) {
        throw new Error(
          `Failed to parse Solana private key from JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Otherwise, assume it's base58 format
    try {
      return bs58.decode(trimmed);
    } catch (error) {
      throw new Error(
        `Failed to parse Solana private key from base58: ${error instanceof Error ? error.message : 'Unknown error'}\n` +
        `Supported formats:\n` +
        `  - JSON array: [1,2,3,...,64]\n` +
        `  - Base58: 5Kd7qB3H8C...`
      );
    }
  }

  /**
   * Transfer SOL to a Solana address
   * @param destinationAddress The recipient's Solana address (base58 string)
   * @param amount The amount in lamports (1 SOL = 1e9 lamports)
   */
  async transferSOL(
    destinationAddress: string,
    amount: bigint
  ): Promise<SolanaTransferResult> {
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
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        {
          commitment: "confirmed",
        }
      );

      console.log(`✓ SOL transfer successful!`);
      console.log(`Signature: ${signature}`);
      console.log(
        `Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`
      );

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
      console.log("Getting source token account...");
      const sourceTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.wallet,
        mintPublicKey,
        this.wallet.publicKey
      );

      console.log(`Source token account: ${sourceTokenAccount.address.toBase58()}`);

      // Get or create destination token account
      console.log("Getting/creating destination token account...");
      const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.wallet,
        mintPublicKey,
        destinationPublicKey
      );

      console.log(
        `Destination token account: ${destinationTokenAccount.address.toBase58()}`
      );

      // Transfer tokens
      console.log("Transferring tokens...");
      const signature = await transfer(
        this.connection,
        this.wallet,
        sourceTokenAccount.address,
        destinationTokenAccount.address,
        this.wallet.publicKey,
        Number(amount)
      );

      console.log(`✓ SPL token transfer successful!`);
      console.log(`Signature: ${signature}`);
      console.log(
        `Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`
      );

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
      // For now, return 0 - SPL token support to be added later
      console.log(`Token balance check not yet implemented for ${tokenMintAddress}`);
      return 0;
    } catch (error) {
      console.error("Error getting token balance:", error);
      return 0;
    }
  }
}
