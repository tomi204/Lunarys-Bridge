// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from 'src/config/configuration';
import validationSchema from 'src/config/validation';
import { join } from 'path';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BridgeEvmToSolModule } from 'src/bridge-evm-to-sol/bridge.module';
import { BridgeSolToEvmModule } from 'src/bridge-sol-to-evm/bridge.module';
import { TokenMappingModule } from 'src/common/token-mapping.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [
        join(process.cwd(), '.env'),
      ],
      load: [configuration],
      validationSchema,
      expandVariables: true,
    }),
    EventEmitterModule.forRoot(),
    TokenMappingModule,           
    BridgeEvmToSolModule,
    BridgeSolToEvmModule,
  ],
})
export class AppModule {}
