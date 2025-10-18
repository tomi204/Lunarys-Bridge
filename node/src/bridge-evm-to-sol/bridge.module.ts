import { Module } from '@nestjs/common';
import { EthereumMonitorService } from 'src/bridge-evm-to-sol/services/ethereum-monitor.service';
import { FheDecryptorService } from 'src/bridge-evm-to-sol/services/fhe-decryptor.service';
import { SolanaTransferService } from 'src/bridge-evm-to-sol/services/solana-transfer.service';
import { BridgeProcessorService } from 'src/bridge-evm-to-sol/services/bridge-processor.service';
import { RelayerApiService } from 'src/bridge-evm-to-sol/services/relayer-api.service';
import { TokenMappingService } from 'src/bridge-evm-to-sol/services/token-mappings.service';

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
})
export class BridgeEvmToSolModule {}
