import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeConfig } from 'src/types/node-config';

export interface TokenMapping {
  evmAddress: string;
  solanaAddress: string;
  decimals: { evm: number; solana: number };
}

@Injectable()
export class TokenMappingService implements OnModuleInit {
  private readonly logger = new Logger(TokenMappingService.name);
  private table: Record<number, TokenMapping[]> = {};

  constructor(private readonly cfg: ConfigService<NodeConfig, true>) {}

  onModuleInit() {
    const chainId            = this.cfg.getOrThrow<number>('fhevmChainId');
    const evmAddress         = (this.cfg.getOrThrow<string>('ethUsdcAddress')).trim().toLowerCase();
    const solanaAddress      = (this.cfg.getOrThrow<string>('solUsdcAddress')).trim();
    const decimalsEvm        = this.cfg.getOrThrow<number>('tokenDecimalsEvm');
    const decimalsSol        = this.cfg.getOrThrow<number>('tokenDecimalsSol');

    if (!evmAddress || !solanaAddress) {
      throw new Error('Invalid token mapping in NodeConfig (addresses are empty)');
    }
    if (!Number.isFinite(decimalsEvm) || !Number.isFinite(decimalsSol)) {
      throw new Error('Invalid token decimals in NodeConfig');
    }

    this.table = {
      [chainId]: [
        {
          evmAddress,
          solanaAddress,
          decimals: { evm: decimalsEvm, solana: decimalsSol },
        },
      ],
    };

    this.logger.log(`Token mapping loaded (chainId=${chainId}): | EVM=${evmAddress} ⇄ SOL=${solanaAddress} (dec ${decimalsEvm}/${decimalsSol})`);
  }

  // Lookups
  private list(chainId: number): TokenMapping[] {
    return this.table[chainId] ?? [];
  }

  getTokenMapping(evmAddress: string, chainId: number): TokenMapping | null {
    if (!evmAddress) return null;
    const needle = evmAddress.toLowerCase();
    return this.list(chainId).find(m => m.evmAddress === needle) ?? null;
  }

  getSolanaTokenAddress(evmAddress: string, chainId: number): string | null {
    return this.getTokenMapping(evmAddress, chainId)?.solanaAddress ?? null;
  }

  getEvmTokenAddress(solanaMint: string, chainId: number): string | null {
    return this.list(chainId).find(m => m.solanaAddress === solanaMint)?.evmAddress ?? null;
  }

  // Conversión de unidades (usa decimales de NodeConfig)
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

  // Utils
  isNativeToken(addr: string): boolean {
    const t = addr?.toLowerCase();
    return t === '0x0000000000000000000000000000000000000000'
        || t === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  }

  nativeEvmAddress(): `0x${string}` {
    return '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as `0x${string}`;
  }

  getAll(chainId: number): TokenMapping[] {
    return this.list(chainId);
  }
}
