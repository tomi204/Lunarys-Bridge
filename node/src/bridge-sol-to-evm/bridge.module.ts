import { Module } from '@nestjs/common';
import { EthereumTransferService } from 'src/bridge-sol-to-evm/services/ethereum-transfer.service';
import { BridgeProcessorSolToEvmService } from 'src/bridge-sol-to-evm/services/bridge-processor.service';
import { SolanaMonitorService } from 'src/bridge-sol-to-evm/services/solana-monitor.service';
import { SolanaProgramService } from 'src/bridge-sol-to-evm/services/solana-program.service';
import { RelayerApiService } from 'src/bridge-evm-to-sol/services/relayer-api.service';
import { TokenMappingService } from 'src/bridge-evm-to-sol/services/token-mappings.service';

@Module({
  providers: [
    // Sol→EVM
    EthereumTransferService,
    BridgeProcessorSolToEvmService,
    SolanaMonitorService,
    SolanaProgramService,
    // Compartidos
    RelayerApiService,
    TokenMappingService,
  ],
  exports: [EthereumTransferService, SolanaMonitorService, BridgeProcessorSolToEvmService],
})
export class BridgeSolToEvmModule {}
