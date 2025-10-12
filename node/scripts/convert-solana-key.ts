#!/usr/bin/env ts-node
/**
 * Convert Solana keypair from JSON format to base58 format
 * Usage: ts-node scripts/convert-solana-key.ts <path-to-keypair.json>
 */

import bs58 from 'bs58';
import { readFileSync } from 'fs';

function convertJsonToBase58(jsonPath: string): string {
  try {
    // Read the JSON file
    const fileContent = readFileSync(jsonPath, 'utf-8');
    const keypairArray = JSON.parse(fileContent);

    // Validate it's an array
    if (!Array.isArray(keypairArray)) {
      throw new Error('Invalid keypair format: expected an array of numbers');
    }

    // Validate it's 64 bytes (32 bytes private + 32 bytes public)
    if (keypairArray.length !== 64) {
      throw new Error(`Invalid keypair length: expected 64 bytes, got ${keypairArray.length}`);
    }

    // Convert the array to Uint8Array
    const secretKey = Uint8Array.from(keypairArray);

    // Encode to base58
    const base58Key = bs58.encode(secretKey);

    return base58Key;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to convert keypair: ${error.message}`);
    }
    throw error;
  }
}

// Main execution
const main = () => {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: ts-node scripts/convert-solana-key.ts <path-to-keypair.json>');
    console.error('');
    console.error('Example:');
    console.error('  ts-node scripts/convert-solana-key.ts ~/.config/solana/id.json');
    console.error('  ts-node scripts/convert-solana-key.ts ./my-keypair.json');
    process.exit(1);
  }

  const keypairPath = args[0];

  try {
    console.log(`Converting Solana keypair from: ${keypairPath}`);
    console.log('');

    const base58Key = convertJsonToBase58(keypairPath);

    console.log('✓ Conversion successful!');
    console.log('');
    console.log('Base58 Private Key:');
    console.log(base58Key);
    console.log('');
    console.log('Add this to your .env file:');
    console.log(`SOLANA_PRIVATE_KEY=${base58Key}`);
    console.log('');
    console.log('⚠️  WARNING: Keep this private key secret! Do not share or commit it.');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

main();
