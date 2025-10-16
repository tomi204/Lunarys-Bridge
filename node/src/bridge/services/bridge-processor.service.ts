// src/bridge/services/bridge-processor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { NodeConfig } from 'src/types/node-config';
import { EthereumMonitorService } from 'src/bridge/services/ethereum-monitor.service';
import { FheDecryptorService } from 'src/bridge/services/fhe-decryptor.service';
import { SolanaTransferService } from 'src/bridge/services/solana-transfer.service';
import { RelayerApiService } from 'src/bridge/services/relayer-api.service';
import { BridgeRequest, BridgeStatus } from 'src/bridge/types';
import { TokenMappingService } from 'src/bridge/services/token-mappings.service';

@Injectable()
export class BridgeProcessorService {
  private readonly logger = new Logger(BridgeProcessorService.name);
  private readonly status = new Map<string, { status: BridgeStatus; details?: any }>();

  private readonly newRelayer: string;
  private readonly chainId: number;
  private readonly testSolDest?: string;

  constructor(
    private readonly config: ConfigService<NodeConfig, true>,
    private readonly eth: EthereumMonitorService,
    private readonly fhe: FheDecryptorService,          // <- usa el decrypt “viejo” por dentro
    private readonly sol: SolanaTransferService,
    private readonly relayerApi: RelayerApiService,
    private readonly tokens: TokenMappingService,  
  ) {
    this.newRelayer = this.config.get('newRelayerAddress');
    this.chainId = this.config.get('fhevmChainId');
    // Permite configurar el fallback como clave de config o variable de entorno
    this.testSolDest =
      (this.config.get<string>('testSolanaDestination') ?? undefined) ||
      process.env.TEST_SOLANA_DESTINATION;
  }

  @OnEvent('bridge.initiated', { async: true })
  async handleBridgeInitiated(req: BridgeRequest) {
    const id = req.requestId.toString();

    try {
      this.setStatus(id, 'detected', { token: req.token, amountRaw: req.amount.toString() });

      // 1) Claim
      let claimTxHash = '';
      if (await this.eth.isRequestClaimed(req.requestId)) {
        this.logger.warn(`Request #${id} already claimed`);
        claimTxHash = '(already-claimed)';
      } else {
        claimTxHash = await this.eth.claimBridgeRequest(req.requestId);
        this.logger.log(`Claimed #${id} tx=${claimTxHash}`);
      }
      this.setStatus(id, 'claimed', { claimTxHash });

      // 2) Decrypt (usa FHE "viejo"; si falla, cae a TEST_SOLANA_DESTINATION)
      let solDest: string;
      let usedFallback = false;
      try {
        solDest = await this.fhe.decryptSolanaAddress(req.requestId, this.newRelayer);
      } catch (e: any) {
        if (!this.testSolDest) {
          throw new Error(`FHE decryption failed and no TEST_SOLANA_DESTINATION configured: ${e?.message ?? e}`);
        }
        usedFallback = true;
        solDest = this.testSolDest;
        this.logger.warn(`FHE decrypt failed for #${id}. Using TEST_SOLANA_DESTINATION=${solDest}`);
      }
      this.setStatus(id, 'decrypted', { solanaDestination: solDest, fallback: usedFallback });

      // 3) Transfer (nativo → SOL, ERC20 → SPL con mapping)
      let signature = '';
      if (this.tokens.isNativeToken(req.token)) {
        const res = await this.sol.transferSOL(solDest, req.amount);
        signature = res.signature;
      } else {
        const mapping = this.tokens.getTokenMapping(req.token, this.chainId);
        if (!mapping) throw new Error(`No token mapping for ${req.token} on chainId=${this.chainId}`);

        // Convertion from decimals to BigInt
        const diff = mapping.decimals.solana - mapping.decimals.evm;
        const converted =
          diff > 0 ? req.amount * (10n ** BigInt(diff))
                   : diff < 0 ? req.amount / (10n ** BigInt(-diff))
                              : req.amount;

        const res = await this.sol.transferSPLToken(mapping.solanaAddress, solDest, converted);
        signature = res.signature;

        this.logger.log(
          `Amount: ${req.amount.toString()} (EVM ${mapping.decimals.evm}) -> ${converted.toString()} (Solana ${mapping.decimals.solana})`
        );
      }
      this.setStatus(id, 'transferred', { signature });

      // 4) Notification to the relayer (best-effort)
      const verification = await this.relayerApi.submitVerification({
        requestId: id.toString(),
        ethClaimTxHash: claimTxHash,
        solanaTransferSignature: signature,
        solanaDestination: solDest,
        amount: req.amount.toString(),
        token: req.token,
      });

      if (verification.success) {
        this.setStatus(id, 'verified', { message: verification.message, ethTx: claimTxHash });
        this.logger.warn(`Verification submission finished for #${id}`);
      } else {
        this.logger.warn(`Verification submission failed for #${id}: ${verification.message ?? '(no message)'}`);
      }

    } catch (e: any) {
      this.logger.error(`Bridge #${id} failed: ${e?.message ?? e}`);
      this.setStatus(id, 'failed', { error: e?.message ?? String(e) });
    }
  }

  getStatus(id: string) {
    return this.status.get(id) ?? { status: 'failed' as BridgeStatus, details: { error: 'unknown id' } };
  }

  private setStatus(id: string, status: BridgeStatus, details?: any) {
    const prev = this.status.get(id)?.details ?? {};
    this.status.set(id, { status, details: { ...prev, ...(details ?? {}) } });
  }
}
