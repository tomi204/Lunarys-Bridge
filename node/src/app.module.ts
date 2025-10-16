// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from 'src/config/configuration';
import validationSchema from 'src/config/validation';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BridgeModule } from 'src/bridge/bridge.module';
import { join } from 'path';

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
    BridgeModule,
  ],
})
export class AppModule {}
