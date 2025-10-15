import { Module } from '@nestjs/common';
import { EthereumMonitorService } from 'src/bridge/services/ethereum-monitor.service';
import { FheDecryptorService } from 'src/bridge/services/fhe-decryptor.service';
import { SolanaTransferService } from 'src/bridge/services/solana-transfer.service';
import { BridgeProcessorService } from 'src/bridge/services/bridge-processor.service';
import { RelayerApiService } from 'src/bridge/services/relayer-api.service';
import { TokenMappingService } from 'src/bridge/services/token-mappings.service';
import { HealthController } from 'src/bridge/controllers/health.controller';

@Module({
  providers: [
    EthereumMonitorService,
    FheDecryptorService,
    SolanaTransferService,
    BridgeProcessorService,
    RelayerApiService,
    TokenMappingService,
  ],
  exports: [TokenMappingService],
  controllers: [HealthController],
})
export class BridgeModule {}
