import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { EthModule } from 'src/eth/eth.module';
import { SolModule } from 'src/sol/sol.module';
import { DbModule } from 'src/common/db.module';

@Module({
  imports: [EthModule, SolModule, DbModule],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
