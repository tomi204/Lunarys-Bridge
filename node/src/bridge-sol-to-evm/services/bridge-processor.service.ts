import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { NodeConfig } from 'src/types/node-config';
import { EthereumTransferService } from 'src/bridge-sol-to-evm/services/ethereum-transfer.service';
import { RelayerApiService } from 'src/bridge-evm-to-sol/services/relayer-api.service';
import { TokenMappingService } from 'src/bridge-evm-to-sol/services/token-mappings.service';
import { SolanaProgramService } from 'src/bridge-sol-to-evm/services/solana-program.service';

type Status = 'detected' | 'claimed' | 'decrypted' | 'transferred' | 'verified' | 'failed';

export interface SolBridgeRequest {
  requestId: bigint;
  payer: string;      // base58
  mint: string;       // base58 (SPL)
  amountAfterFee: bigint;
}

@Injectable()
export class BridgeProcessorSolToEvmService {
  private readonly logger = new Logger(BridgeProcessorSolToEvmService.name);
  private readonly status = new Map<string, { status: Status; details?: any }>();

  private readonly chainId: number;
  private readonly testEvmDest?: `0x${string}`;

  constructor(
    private readonly config: ConfigService<NodeConfig, true>,
    private readonly ethTx: EthereumTransferService,
    private readonly relayerApi: RelayerApiService,
    private readonly tokens: TokenMappingService,
    private readonly solProg: SolanaProgramService,
  ) {
    this.chainId = this.config.get('fhevmChainId');
    this.testEvmDest = (this.config.get<string>('testEvmDestination') as `0x${string}`) || (process.env.TEST_EVM_DESTINATION as any);
  }

  @OnEvent('sol.bridge.initiated', { async: true })
  async onSolBridgeInitiated(ev: SolBridgeRequest) {
    const id = ev.requestId.toString();
    try {
      this.setStatus(id, 'detected', { mint: ev.mint, amount: ev.amountAfterFee.toString() });

      // 1) Claim en Solana (bond)
      const minBond = Number(this.config.get('solanaMinSolverBondLamports') ?? 1000000);
      const ownerPk = this.config.get('solanaRequestOwner')!; // o derivá desde el evento si lo incluís
      const claimSig = await this.solProg.claimRequest(ev.requestId, new (await import('@solana/web3.js')).PublicKey(ownerPk), minBond);
      this.setStatus(id, 'claimed', { claimSig });

      // 2) Resolver destino EVM (decrypt o fallback)
      let evmDest: `0x${string}`;
      try {
        // TODO: integrar tu decrypt/confidencial (Arcium) si lo emitís/almacenás
        if (!this.testEvmDest) throw new Error('No test EVM destination configured');
        evmDest = this.testEvmDest;
        this.logger.warn(`Using TEST_EVM_DESTINATION for #${id}: ${evmDest}`);
      } catch (e: any) {
        throw new Error(`EVM destination resolve failed: ${e?.message ?? e}`);
      }
      this.setStatus(id, 'decrypted', { evmDestination: evmDest });

      // 3) Transferir en EVM (ETH/ERC20) con mapping SPL->EVM
      const mapping = this.tokens.getAll(this.chainId).find(m => m.solanaAddress === ev.mint) ??
                      null;
      const isNativeOnEvm = !mapping; // si no hay mapping, asumimos ETH (o forzalo por config)
      let txHash: `0x${string}`;

      if (isNativeOnEvm) {
        txHash = (await this.ethTx.transferNative(evmDest, ev.amountAfterFee)).txHash;
      } else {
        // conversión de decimales: de SPL->EVM
        const diff = mapping!.decimals.evm - mapping!.decimals.solana;
        const converted = diff > 0
          ? ev.amountAfterFee * (10n ** BigInt(diff))
          : diff < 0
            ? ev.amountAfterFee / (10n ** BigInt(-diff))
            : ev.amountAfterFee;

        const res = await this.ethTx.transferErc20(mapping!.evmAddress as `0x${string}`, evmDest, converted);
        if (!res.success) throw new Error(res.error || 'ERC20 transfer failed');
        txHash = res.txHash;
      }
      this.setStatus(id, 'transferred', { txHash });

      // 4) Notificar al relayer (para que haga verify_and_settle_spl en Solana)
      const verification = await this.relayerApi.submitVerification({
        requestId: id,
        ethClaimTxHash: claimSig,                 // usamos el claimSig en el campo genérico
        solanaTransferSignature: 'n/a',           // invertido; tu relayer lo sabe
        solanaDestination: 'n/a',
        amount: ev.amountAfterFee.toString(),
        token: mapping?.evmAddress ?? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        evidenceURL: undefined,
      });

      const ok = verification.success;
      this.setStatus(id, 'verified', { message: verification.message });
      if (!ok) this.logger.warn(`Relayer verification failed for #${id}: ${verification.message}`);

    } catch (e: any) {
      this.logger.error(`Sol→EVM Bridge #${id} failed: ${e?.message ?? e}`);
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
