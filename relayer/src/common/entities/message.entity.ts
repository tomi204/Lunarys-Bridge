import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('messages')
export class MessageEntity {
  @PrimaryColumn({ type: 'varchar', length: 66 }) // 0x + 64
  msgId!: string;

  @Column({ type: 'int' })
  kv!: number;

  // Canonical fields (store bigints as strings to be DB-agnostic)
  @Column({ type: 'smallint' }) version!: number;
  @Column({ type: 'smallint' }) dir!: number;

  @Column({ type: 'varchar', length: 78 }) srcChainId!: string; // bigint string
  @Column({ type: 'varchar', length: 78 }) dstChainId!: string;

  @Column({ type: 'varchar', length: 66 }) srcTxId!: string;      // bytes32
  @Column({ type: 'varchar', length: 66 }) originToken!: string;   // bytes32
  @Column({ type: 'varchar', length: 78 }) amount!: string;        // bigint string
  @Column({ type: 'varchar', length: 66 }) recipient!: string;     // bytes32
  @Column({ type: 'varchar', length: 78 }) nonce!: string;         // bigint string
  @Column({ type: 'varchar', length: 78 }) expiry!: string;        // bigint string

  @Index()
  @Column({ type: 'varchar', length: 32 })
  status!: 'observed' | 'attested' | 'submitted' | 'confirmed' | 'failed';

  // Optional signature (ECDSA)
  @Column({ type: 'int', nullable: true }) sigV?: number | null;
  @Column({ type: 'varchar', length: 66, nullable: true }) sigR?: string | null;
  @Column({ type: 'varchar', length: 66, nullable: true }) sigS?: string | null;

  @Column({ type: 'text', nullable: true }) error?: string | null;

  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
