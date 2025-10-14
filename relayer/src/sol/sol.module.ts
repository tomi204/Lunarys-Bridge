import { Module } from '@nestjs/common';
import { SolService } from 'src/sol/sol.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [SolService],
  exports: [SolService],
})
export class SolModule {}
