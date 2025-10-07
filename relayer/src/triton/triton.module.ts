import { Module } from '@nestjs/common';
import { TritonService } from './triton.service';
import { CryptoModule } from '../crypto/crypto.module';
import { RelayerModule } from '../relayer/relayer.module';

@Module({
  imports: [CryptoModule, RelayerModule],
  providers: [TritonService],
  exports: [TritonService],
})
export class TritonModule {}
