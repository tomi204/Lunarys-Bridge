import { Module } from '@nestjs/common';
import { EthereumTransferService } from './services/ethereum-transfer.service';
import { BridgeProcessorSolToEvmService } from './services/bridge-processor.service';
import { SolanaMonitorService } from './services/solana-monitor.service';
import { SolanaProgramService } from './services/solana-program.service';
import { RelayerApiService } from './services/relayer-api.service';
import { ArciumReaderService } from './services/arcium-reader.service';
import { SolverKeyService } from './services/solver-key.service';
import { DestinationDecryptService } from './services/destination-decrypt.service';
import { TokenMappingModule } from 'src/common/token-mapping.module';
import { DevToolsController } from './controllers/dev-tool-keys.controller';
import { SolverKeyToolService } from './services/solver-key-tool.service';

@Module({
  imports: [TokenMappingModule],
  controllers: [DevToolsController], 
  providers: [
    EthereumTransferService,
    BridgeProcessorSolToEvmService,
    SolanaMonitorService,
    SolanaProgramService,
    RelayerApiService,
    ArciumReaderService,
    SolverKeyService,
    DestinationDecryptService,
    SolverKeyToolService
  ],
  exports: [EthereumTransferService, SolanaMonitorService, BridgeProcessorSolToEvmService],
})
export class BridgeSolToEvmModule {}
