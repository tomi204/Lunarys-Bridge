import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

export interface TokenMapping {
  evmAddress: string;
  solanaAddress: string;
  name: string;
  decimals: { evm: number; solana: number };
}

@Injectable()
export class TokenMappingService {
  private readonly logger = new Logger(TokenMappingService.name);
  constructor(
    @Inject(tokenMappingsConfig.KEY)
    private readonly cfg: ConfigType<typeof tokenMappingsConfig>,
  ) {}

  private list(chainId: number): TokenMapping[] {
    return this.cfg.byChain[chainId] ?? [];
  }

  getTokenMapping(evmAddress: string, chainId: number): TokenMapping | null {
    if (!evmAddress) return null;
    const needle = evmAddress.toLowerCase();
    return this.list(chainId).find(m => m.evmAddress.toLowerCase() === needle) ?? null;
  }

  getSolanaTokenAddress(evmAddress: string, chainId: number): string | null {
    return this.getTokenMapping(evmAddress, chainId)?.solanaAddress ?? null;
  }

  isNativeToken(addr: string): boolean {
    const t = addr?.toLowerCase();
    return t === '0x0000000000000000000000000000000000000000'
        || t === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  }

  getAll(chainId: number): TokenMapping[] {
    return this.list(chainId);
  }
}
