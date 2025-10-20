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
  payer: string;      // base58 Solana pubkey (this is the request_owner in Variant B)
  mint: string;       // SPL mint (or WSOL)
  amountAfterFee: bigint;
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

  /**
   * Pipeline on deposit event (SOL → EVM):
   * 1) mark as detected
   * 2) claim + reseal + decrypt destination off-chain (DestinationDecryptService)
   * 3) send funds on EVM (native or ERC-20)
   * 4) notify relayer API for on-chain settle
   */
  @OnEvent('sol.bridge.initiated', { async: true })
  async onSolBridgeInitiated(ev: SolBridgeRequest) {
    const id = ev.requestId.toString();

    try {
      // 0) Basic logging + initial status
      this.setStatus(id, 'detected', { mint: ev.mint, amount: ev.amountAfterFee.toString() });
      this.logger.log(`SOL→EVM detected #${id}: mint=${ev.mint} amountAfterFee=${ev.amountAfterFee}`);

      // 1) Parse request_owner from the event (Variant B). DO NOT pull it from config.
      const requestOwner = new PublicKey(ev.payer);

      // 2) Claim + reseal + decrypt destination (ECDH with MXE)
      const minBond = Number(this.config.get('solanaMinSolverBondLamports') ?? 1_000_000);
      const evmDest = await this.decryptor.resolveEvmDestination(ev.requestId, requestOwner, minBond);
      this.setStatus(id, 'decrypted', { evmDestination: evmDest });

      // 3) Decide native vs ERC-20 on EVM using the token mapping table
      const mapping = this.tokens.getAll(this.chainId).find(m => m.solanaAddress === ev.mint) ?? null;
      const isNativeOnEvm = !mapping;

      // 4) Transfer on EVM
      let txHash: `0x${string}`;

      if (isNativeOnEvm) {
        // Native coin transfer (e.g., ETH)
        const res = await this.ethTx.transferNative(evmDest, ev.amountAfterFee);
        txHash = res.txHash;
      } else {
        // ERC-20 transfer with decimal normalization (Solana vs EVM)
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

      // 5) Notify relayer for verification/settlement record
      const verification = await this.relayerApi.submitVerificationSolToEvm({
        requestId: id,
        solClaimSignature: 'included-by-claim', // you can replace with the actual claim tx if you propagate it
        evmTransferTxHash: txHash,
        evmDestination: evmDest,
        amount: ev.amountAfterFee.toString(),
        token: mapping?.evmAddress ?? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // native sentinel
      });

      this.setStatus(id, 'verified', { message: verification.message });
      this.logger.log(`SOL→EVM verified #${id}: ${verification.message}`);
    } catch (e: any) {
      this.logger.error(`SOL→EVM #${id} failed: ${e?.message ?? e}`);
      this.setStatus(id, 'failed', { error: e?.message ?? String(e) });
    }
  }

  /** Read last-known status of a request (for simple polling/health endpoints). */
  getStatus(id: string) {
    return this.status.get(id) ?? { status: 'failed' as Status, details: { error: 'unknown id' } };
  }

  /** Merge status details, keeping previous info when we advance stages. */
  private setStatus(id: string, status: Status, details?: any) {
    const prev = this.status.get(id)?.details ?? {};
    this.status.set(id, { status, details: { ...prev, ...(details ?? {}) } });
  }
}
