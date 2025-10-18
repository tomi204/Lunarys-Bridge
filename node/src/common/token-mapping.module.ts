import { Global, Module } from '@nestjs/common';
import { TokenMappingService } from './token-mapping.service';

@Global()
@Module({
  providers: [TokenMappingService],
  exports: [TokenMappingService],
})
export class TokenMappingModule {}
