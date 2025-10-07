import { Module } from '@nestjs/common';
import { DevController } from './dev.controller';
import { CryptoService } from 'src/crypto/crypto.service';
import { RelayerModule } from 'src/relayer/relayer.module';

@Module({
  imports: [RelayerModule],
  controllers: [DevController],
  providers: [CryptoService],
})
export class DevModule {}
