import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BridgeStatus } from './bridge-status.enum';

@Entity({ name: 'evm_to_sol' })
@Index(['requestId'], { unique: true })
export class EvmToSolRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  requestId!: string;        // EVM requestId (string for safety)

  @Column({ type: 'text', default: BridgeStatus.RECEIVED })
  status!: BridgeStatus;

  // EVM side (source)
  @Column()
  tokenEvm!: string;          // 0x token address
  @Column()
  amountEvm!: string;         // bigint as string
  @Column({ nullable: true })
  ethClaimTxHash?: string;    // solver claim tx (optional)

  // Solana side (destination)
  @Column()
  solanaSignature!: string;   // transfer signature that should credit recipient
  @Column()
  solanaRecipient!: string;   // base58 recipient on Solana
  @Column({ nullable: true })
  tokenSolMint?: string;      // SPL mint ('' => native SOL)
  @Column({ nullable: true })
  amountSol?: string;         // bigint as string after decimals adjust

  // Off-chain evidence / settlement
  @Column({ nullable: true })
  destTxHash?: string;        // keccak(signature) or similar
  @Column({ nullable: true })
  evidenceHash?: string;
  @Column({ nullable: true })
  evidenceURL?: string;

  // EVM settlement (verifyAndSettle) tx hash
  @Column({ nullable: true })
  settlementTxHash?: string;

  // Error/debug
  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
