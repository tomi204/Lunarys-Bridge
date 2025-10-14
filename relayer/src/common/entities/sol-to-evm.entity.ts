import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BridgeStatus } from './bridge-status.enum';

@Entity({ name: 'sol_to_evm' })
@Index(['requestId'], { unique: true })
export class SolToEvmRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  requestId!: string;         // app-level bridge id (string for safety)

  @Column({ type: 'text', default: BridgeStatus.RECEIVED })
  status!: BridgeStatus;

  // Solana side (source)
  @Column()
  solanaDepositSignature!: string; // tx that funded the bridge vault
  @Column()
  solanaVault!: string;            // vault that should have increased
  @Column({ nullable: true })
  solanaMint?: string;             // '' => native SOL
  @Column()
  amountSol!: string;              // bigint as string

  // EVM side (destination)
  @Column()
  evmRecipient!: string;           // 0x address
  @Column()
  evmToken!: string;               // 0x token address
  @Column({ nullable: true })
  amountEvm?: string;              // bigint as string after decimals adjust

  // EVM settlement (deliverTokens) tx hash
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
