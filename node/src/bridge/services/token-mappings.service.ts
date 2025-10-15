import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeConfig } from 'src/types/node-config';

export interface TokenMapping {
  /** EVM token address (lowercased for matching) */
  evmAddress: string;
  /** SPL mint (base58) on Solana */
  solanaAddress: string;
  /** Human-readable token name */
  name: string;
  /** Decimals on each chain */
  decimals: { evm: number; solana: number };
}

/**
 * Mirrors the “old file” approach (in-memory table by chainId + helpers),
 * but wired for Nest via DI and ConfigService envs.
 */
@Injectable()
export class TokenMappingService implements OnModuleInit {
  private readonly logger = new Logger(TokenMappingService.name);

  // In-memory table: chainId -> array of mappings
  private TOKEN_MAPPINGS: Record<number, TokenMapping[]> = {};

  constructor(private readonly config: ConfigService<NodeConfig, true>) {}

  onModuleInit() {
    const chainId = this.config.get('fhevmChainId');

    // Read addresses from config (which already pulls from process.env)
    const ethUsdc = (this.config.get('ethUsdcAddress') || '').trim().toLowerCase();
    const solUsdc = (this.config.get('solUsdcAddress') || '').trim();

    // Sensible defaults for Sepolia if envs are missing
    const SEPOLIA_DEFAULT_EVM = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238';
    const SEPOLIA_DEFAULT_SOL = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

    // Build the mapping table just like the old static file
    this.TOKEN_MAPPINGS = {
      // Sepolia
      11155111: [
        {
          evmAddress: (ethUsdc || SEPOLIA_DEFAULT_EVM).toLowerCase(),
          solanaAddress: solUsdc || SEPOLIA_DEFAULT_SOL,
          name: 'USDC',
          decimals: { evm: 6, solana: 6 },
        },
      ],
      // Mainnet (example)
      1: [
        {
          evmAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          solanaAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          name: 'USDC',
          decimals: { evm: 6, solana: 6 },
        },
      ],
    };

    if (!this.TOKEN_MAPPINGS[chainId]) {
      this.logger.warn(`No token mappings preloaded for chainId=${chainId}. ERC-20 bridging will fail unless you add mappings.`);
    } else {
      const list = this.TOKEN_MAPPINGS[chainId].map(m => m.evmAddress).join(', ');
      this.logger.log(`Loaded ${this.TOKEN_MAPPINGS[chainId].length} mapping(s) for chainId=${chainId}: ${list}`);
    }
  }

  // ===== Helpers (same API as the old file) =====

  getSolanaTokenAddress(evmTokenAddress: string, chainId: number): string | null {
    const mapping = this.getTokenMapping(evmTokenAddress, chainId);
    return mapping?.solanaAddress ?? null;
  }

  getTokenMapping(evmTokenAddress: string, chainId: number): TokenMapping | null {
    if (!evmTokenAddress) return null;
    const list = this.TOKEN_MAPPINGS[chainId];
    if (!list?.length) return null;

    const needle = evmTokenAddress.toLowerCase();
    return list.find(m => m.evmAddress.toLowerCase() === needle) ?? null;
  }

  isNativeToken(tokenAddress: string): boolean {
    if (!tokenAddress) return false;
    const t = tokenAddress.toLowerCase();
    return (
      t === '0x0000000000000000000000000000000000000000' ||
      t === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    );
  }

  // Optional: useful for debugging/inspection
  getAll(chainId: number): TokenMapping[] {
    return this.TOKEN_MAPPINGS[chainId] ?? [];
  }
}
