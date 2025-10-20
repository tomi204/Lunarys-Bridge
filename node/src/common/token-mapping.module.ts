// src/common/token-mapping.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TokenMappingService } from './token-mapping.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [TokenMappingService],
  exports: [TokenMappingService],
})
export class TokenMappingModule {}
