import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { TritonModule } from './triton/triton.module';
import { CryptoModule } from './crypto/crypto.module';
import { RelayerModule } from './relayer/relayer.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EthModule } from './eth/eth.module';
import { DevModule } from './dev/dev.module';

const featureModules = [
  AppConfigModule,
  CryptoModule,
  RelayerModule,
  TritonModule,
  EthModule,
  DevModule,
];

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database.sqlite',
      autoLoadEntities: true,
      synchronize: true,
      logging: ['error', 'warn'],
    }),
    ...featureModules,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
