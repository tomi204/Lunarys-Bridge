import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyBridgeSolToEvmDto {
  @IsString() @IsNotEmpty()
  requestId!: string;               // u64 en string

  @IsString() @IsNotEmpty()
  solClaimSignature!: string;       // firma tx de claim_request

  @IsString() @IsNotEmpty()
  evmTransferTxHash!: string;       // hash tx en EVM

  @IsString() @IsNotEmpty()
  evmDestination!: string;          // 0x...

  @IsString() @IsNotEmpty()
  amount!: string;                  // en unidades enteras (post conversión si aplica)

  @IsString() @IsNotEmpty()
  token!: string;                   // EVM token address (0x0 si ETH)
}