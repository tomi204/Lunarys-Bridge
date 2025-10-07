import { Module } from '@nestjs/common';
import { EthWatcherService } from './eth.watcher.service';
import { RelayerModule } from '../relayer/relayer.module';

@Module({
  imports: [RelayerModule],
  providers: [EthWatcherService],
  exports: [EthWatcherService],
})
export class EthModule {}