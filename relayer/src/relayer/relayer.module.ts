import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RelayerProcessor } from './relayer.processor';
import { SignerModule } from 'src/signer/signer.module';
import { SubmitterModule } from 'src/submitter/submitter.module';
import { MessageEntity } from 'src/common/entities/message.entity';
import { MESSAGE_STORE } from './store';
import { TypeormMessageStore } from './store.typeorm';
import { ReprocessorService } from './relayer.reprocessor';

@Module({
  imports: [SignerModule, SubmitterModule, TypeOrmModule.forFeature([MessageEntity])],
  providers: [
    RelayerProcessor,
    { provide: MESSAGE_STORE, useClass: TypeormMessageStore },
    ReprocessorService,
  ],
  exports: [RelayerProcessor, MESSAGE_STORE],
})
export class RelayerModule {}
