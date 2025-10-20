import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyBridgeDto {
  @IsString() @IsNotEmpty()
  requestId!: string;

  @IsString() @IsNotEmpty()
  ethClaimTxHash!: string;

  @IsString() @IsNotEmpty()
  solanaTransferSignature!: string;

  @IsString() @IsNotEmpty()
  solanaDestination!: string;

  @IsString() @IsNotEmpty()
  amount!: string;

  @IsString() @IsNotEmpty()
  token!: string;
}
