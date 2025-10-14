import { IsString, IsEthereumAddress, IsNotEmpty, Matches, IsOptional } from 'class-validator';

export class EvmToSolVerificationDto {
  @IsString() @IsNotEmpty()
  requestId!: string;

  @IsString() @IsNotEmpty()
  ethClaimTxHash!: string; // just logged/evidence

  @IsString() @IsNotEmpty()
  solanaTransferSignature!: string;

  @IsString() @IsNotEmpty()
  solanaDestination!: string; // base58

  @IsString() @IsNotEmpty()
  amount!: string; // bigint as string (EVM units)

  @IsEthereumAddress()
  token!: `0x${string}`; // ERC20 (0x0…0 for native mapping if you use it)

  @IsOptional()
  @Matches(/^https?:\/\//)
  evidenceURL?: string; // optional, if you want to use the URL overload
}
