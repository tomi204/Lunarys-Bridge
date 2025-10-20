// src/bridge-sol-to-evm/bridge.module.ts
import { Module } from '@nestjs/common';
import { EthereumTransferService } from './services/ethereum-transfer.service';
import { BridgeProcessorSolToEvmService } from './services/bridge-processor.service';
import { SolanaMonitorService } from './services/solana-monitor.service';
import { SolanaProgramService } from './services/solana-program.service';
import { RelayerApiService } from 'src/bridge-evm-to-sol/services/relayer-api.service';

@Module({
  providers: [
    EthereumTransferService,
    BridgeProcessorSolToEvmService,
    SolanaMonitorService,
    SolanaProgramService,
    RelayerApiService,
  ],
  exports: [EthereumTransferService, SolanaMonitorService, BridgeProcessorSolToEvmService],
})
export class BridgeSolToEvmModule {}
