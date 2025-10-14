import { IsString, IsEthereumAddress, IsNotEmpty, IsOptional } from 'class-validator';

export class SolToEvmVerificationDto {
  @IsString() @IsNotEmpty()
  requestId!: string;

  @IsString() @IsNotEmpty()
  solanaDepositSignature!: string; // deposit tx on Solana program

  @IsString() @IsNotEmpty()
  solanaVault!: string; // the program’s vault (SOL or SPL token account) that received funds

  @IsString() @IsNotEmpty()
  amount!: string; // bigint as string (SOL units if SOL, SPL smallest unit if SPL)

  @IsEthereumAddress()
  evmRecipient!: `0x${string}`;

  @IsEthereumAddress()
  evmToken!: `0x${string}`; // ERC20 to deliver on EVM side

  @IsOptional()
  solanaMint?: string; // when SPL; omit for SOL native
}
