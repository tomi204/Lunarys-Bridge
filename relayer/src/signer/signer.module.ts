import { Module } from '@nestjs/common';
import { ATTESTATION_PROVIDER } from './types';
import { ArciumSigner } from './arcium.signer';

@Module({
  providers: [
    { provide: ATTESTATION_PROVIDER, useClass: ArciumSigner },
  ],
  exports: [ATTESTATION_PROVIDER],
})
export class SignerModule {}
