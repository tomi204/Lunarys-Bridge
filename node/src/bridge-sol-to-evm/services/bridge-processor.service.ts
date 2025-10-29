import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PublicKey } from '@solana/web3.js';

import { NodeConfig } from 'src/types/node-config';
import { EthereumTransferService } from './ethereum-transfer.service';
import { RelayerApiService } from './relayer-api.service';
import { TokenMappingService } from 'src/common/token-mapping.service';
import { DestinationDecryptService } from './destination-decrypt.service';

export type Status = 'detected' | 'claimed' | 'decrypted' | 'transferred' | 'verified' | 'failed';

export interface SolBridgeRequest {
  requestId: bigint;
  payer: string;      // base58 Solana pubkey (request_owner)
  mint: string;       // SPL mint (o WSOL)
  amountAfterFee: bigint;
}

// Puede venir como string o como objeto enriquecido
type DestOut =
  | `0x${string}`
  | { evmDestination: `0x${string}`; claimSig?: string };

function normalizeDest(out: DestOut): { evmDest: `0x${string}`; claimSig: string } {
  if (typeof out === 'string') {
    return { evmDest: out as `0x${string}`, claimSig: 'included-by-claim' };
  }
  return {
    evmDest: out.evmDestination,
    claimSig: out.claimSig ?? 'included-by-claim',
  };
}

@Injectable()
export class BridgeProcessorSolToEvmService {
  private readonly logger = new Logger(BridgeProcessorSolToEvmService.name);
  private readonly status = new Map<string, { status: Status; details?: any }>();
  private readonly chainId: number;

  constructor(
    private readonly config: ConfigService<NodeConfig, true>,
    private readonly ethTx: EthereumTransferService,
    private readonly relayerApi: RelayerApiService,
    private readonly tokens: TokenMappingService,
    private readonly decryptor: DestinationDecryptService,
  ) {
    this.chainId = this.config.get('fhevmChainId');
  }

  @OnEvent('sol.bridge.initiated', { async: true })
  async onSolBridgeInitiated(ev: SolBridgeRequest) {
    const id = ev.requestId.toString();

    try {
      this.setStatus(id, 'detected', { mint: ev.mint, amount: ev.amountAfterFee.toString() });
      this.logger.log(`SOL→EVM detected #${id}: mint=${ev.mint} amountAfterFee=${ev.amountAfterFee}`);

      const requestOwner = new PublicKey(ev.payer);
      const minBond = Number(this.config.get('solanaMinSolverBondLamports') ?? 1_000_000);

      // Puede devolver string o { evmDestination, claimSig }
      const out = (await this.decryptor.resolveEvmDestination(
        ev.requestId,
        requestOwner,
        minBond,
      )) as DestOut;

      const { evmDest, claimSig } = normalizeDest(out);
      this.setStatus(id, 'decrypted', { evmDestination: evmDest, claimSig });

      // mapping token → decidir nativo o ERC20
      const mapping = this.tokens.getAll(this.chainId).find(m => m.solanaAddress === ev.mint) ?? null;
      const isNativeOnEvm = !mapping;

      let txHash: `0x${string}`;

      if (isNativeOnEvm) {
        const res = await this.ethTx.transferNative(evmDest, ev.amountAfterFee);
        if (!res.success) throw new Error(res.error || 'Native transfer failed');
        txHash = res.txHash;
      } else {
        const diff = (mapping!.decimals.evm ?? 0) - (mapping!.decimals.solana ?? 0);
        const converted = diff > 0
          ? ev.amountAfterFee * (10n ** BigInt(diff))
          : diff < 0
            ? ev.amountAfterFee / (10n ** BigInt(-diff))
            : ev.amountAfterFee;

        const res = await this.ethTx.transferErc20(
          mapping!.evmAddress as `0x${string}`,
          evmDest,
          converted,
        );
        if (!res.success) throw new Error(res.error || 'ERC20 transfer failed');
        txHash = res.txHash;
      }

      this.setStatus(id, 'transferred', { txHash });
      this.logger.log(`SOL→EVM transferred #${id}: tx=${txHash}`);

      const verification = await this.relayerApi.submitVerificationSolToEvm({
        requestId: id,
        solClaimSignature: claimSig,
        evmTransferTxHash: txHash,
        evmDestination: evmDest,
        amount: ev.amountAfterFee.toString(),
        token: mapping?.evmAddress ?? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      });

      this.setStatus(id, 'verified', { message: verification.message });
      this.logger.log(`SOL→EVM verified #${id}: ${verification.message}`);
    } catch (e: any) {
      this.logger.error(`SOL→EVM #${id} failed: ${e?.message ?? e}`);
      this.setStatus(id, 'failed', { error: e?.message ?? String(e) });
    }
  }

  getStatus(id: string) {
    return this.status.get(id) ?? { status: 'failed' as Status, details: { error: 'unknown id' } };
  }

  private setStatus(id: string, status: Status, details?: any) {
    const prev = this.status.get(id)?.details ?? {};
    this.status.set(id, { status, details: { ...prev, ...(details ?? {}) } });
  }
}
