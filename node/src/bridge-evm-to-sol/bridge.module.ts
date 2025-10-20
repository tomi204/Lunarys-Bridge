import { Module } from '@nestjs/common';
import { EthereumMonitorService } from 'src/bridge-evm-to-sol/services/ethereum-monitor.service';
import { FheDecryptorService } from 'src/bridge-evm-to-sol/services/fhe-decryptor.service';
import { SolanaTransferService } from 'src/bridge-evm-to-sol/services/solana-transfer.service';
import { BridgeProcessorService } from 'src/bridge-evm-to-sol/services/bridge-processor.service';
import { RelayerApiService } from 'src/bridge-evm-to-sol/services/relayer-api.service';
import { HealthController } from 'src/bridge-evm-to-sol/controllers/health.controller';
import { TokenMappingModule } from 'src/common/token-mapping.module';

@Module({
  imports: [TokenMappingModule],
  providers: [
    EthereumMonitorService,
    FheDecryptorService,
    SolanaTransferService,
    BridgeProcessorService,
    RelayerApiService,
  ],
  controllers: [HealthController],
})
export class BridgeEvmToSolModule {}
