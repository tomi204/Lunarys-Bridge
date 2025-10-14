import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvmToSolRecord } from './entities/evm-to-sol.entity';
import { SolToEvmRecord } from './entities/sol-to-evm.entity';
import { EvmToSolRepository } from './repositories/evm-to-sol.repository';
import { SolToEvmRepository } from './repositories/sol-to-evm.repository';

@Module({
  imports: [TypeOrmModule.forFeature([EvmToSolRecord, SolToEvmRecord])],
  providers: [EvmToSolRepository, SolToEvmRepository],
  exports: [EvmToSolRepository, SolToEvmRepository],
})
export class DbModule {}
