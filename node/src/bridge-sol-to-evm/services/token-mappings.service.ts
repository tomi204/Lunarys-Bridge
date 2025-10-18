// src/bridge-evm-to-sol/services/token-mappings.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeConfig } from '@/types/node-config';

export interface TokenMapping {
  evmAddress: string;     // 0x...
  solanaAddress: string;  // base58 mint
  name: string;
  decimals: { evm: number; solana: number };
}

@Injectable()
export class TokenMappingService implements OnModuleInit {
  private readonly logger = new Logger(TokenMappingService.name);
  private TOKEN_MAPPINGS: Record<number, TokenMapping[]> = {};

  constructor(private readonly config: ConfigService<NodeConfig, true>) {}

  onModuleInit() {
    const chainId = this.config.get('fhevmChainId');

    const ethUsdc = (this.config.get('ethUsdcAddress') || '').trim().toLowerCase();
    const solUsdc = (this.config.get('solUsdcAddress') || '').trim();

    const SEPOLIA_DEFAULT_EVM = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
    const SEPOLIA_DEFAULT_SOL = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

    this.TOKEN_MAPPINGS = {
      11155111: [
        {
          evmAddress: (ethUsdc || SEPOLIA_DEFAULT_EVM).toLowerCase(),
          solanaAddress: solUsdc || SEPOLIA_DEFAULT_SOL,
          name: 'USDC',
          decimals: { evm: 6, solana: 6 },
        },
      ],
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
      this.logger.warn(`No token mappings preloaded for chainId=${chainId}. ERC-20 bridging may fail unless you add mappings.`);
    } else {
      const list = this.TOKEN_MAPPINGS[chainId].map(m => m.evmAddress).join(', ');
      this.logger.log(`Loaded ${this.TOKEN_MAPPINGS[chainId].length} mapping(s) for chainId=${chainId}: ${list}`);
    }
  }

  // ===== Lookups EVM → Sol =====
  getSolanaTokenAddress(evmTokenAddress: string, chainId: number): string | null {
    const m = this.getTokenMapping(evmTokenAddress, chainId);
    return m?.solanaAddress ?? null;
  }

  getTokenMapping(evmTokenAddress: string, chainId: number): TokenMapping | null {
    if (!evmTokenAddress) return null;
    const list = this.TOKEN_MAPPINGS[chainId];
    if (!list?.length) return null;
    const needle = evmTokenAddress.toLowerCase();
    return list.find(m => m.evmAddress.toLowerCase() === needle) ?? null;
  }

  // ===== Lookups Sol → EVM (nuevo) =====
  getEvmTokenAddress(solanaMint: string, chainId: number): string | null {
    const m = this.getBySolanaMint(solanaMint, chainId);
    return m?.evmAddress ?? null;
  }

  getBySolanaMint(solanaMint: string, chainId: number): TokenMapping | null {
    const list = this.TOKEN_MAPPINGS[chainId];
    if (!list?.length) return null;
    return list.find(m => m.solanaAddress === solanaMint) ?? null;
  }

  // ===== Conversión de decimales =====
  convertEvmToSol(amountEvmUnits: bigint, mapping: TokenMapping): bigint {
    const diff = mapping.decimals.solana - mapping.decimals.evm;
    if (diff > 0) return amountEvmUnits * (10n ** BigInt(diff));
    if (diff < 0) return amountEvmUnits / (10n ** BigInt(-diff));
    return amountEvmUnits;
  }

  convertSolToEvm(amountSolUnits: bigint, mapping: TokenMapping): bigint {
    const diff = mapping.decimals.evm - mapping.decimals.solana;
    if (diff > 0) return amountSolUnits * (10n ** BigInt(diff));
    if (diff < 0) return amountSolUnits / (10n ** BigInt(-diff));
    return amountSolUnits;
  }

  // ===== Utilidades =====
  isNativeToken(tokenAddress: string): boolean {
    if (!tokenAddress) return false;
    const t = tokenAddress.toLowerCase();
    return t === '0x0000000000000000000000000000000000000000'
        || t === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  }

  /** Dirección “nativa” que usamos en EVM cuando no hay ERC-20 (ETH) */
  nativeEvmAddress(): `0x${string}` {
    return '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as `0x${string}`;
  }

  getAll(chainId: number): TokenMapping[] {
    return this.TOKEN_MAPPINGS[chainId] ?? [];
  }
}
