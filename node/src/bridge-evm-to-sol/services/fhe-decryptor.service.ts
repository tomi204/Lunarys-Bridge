import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { NodeConfig } from 'src/types/node-config';
import { FHEDecryptor } from '../../fhe/fheDescrypt';

@Injectable()
export class FheDecryptorService implements OnModuleInit {
  private readonly logger = new Logger(FheDecryptorService.name);
  private decryptor: FHEDecryptor | null = null;
  private newRelayer!: string;

  constructor(private readonly config: ConfigService<NodeConfig, true>) {}

  async onModuleInit() {
    // Config base
    const ethereumRpcUrl = this.config.get('ethereumRpcUrl');
    const fhevmChainId   = this.config.get('fhevmChainId');
    const aclAddr        = this.config.get('fhevmAclAddress');
    const kmsAddr        = this.config.get('fhevmKmsVerifierAddress');
    this.newRelayer      = this.config.get('newRelayerAddress');

    // Signer (relayer si está, sino la key del nodo)
    const decryptionPk =
      this.config.get('ethereumPrivateKey') || this.config.get('ethereumPrivateKey');

    const provider = new ethers.JsonRpcProvider(ethereumRpcUrl);
    const wallet   = new ethers.Wallet(decryptionPk, provider);

    // Armamos un NodeConfig mínimo para el legacy decryptor
    const nodeCfg: NodeConfig = {
      ethereumRpcUrl,
      fhevmChainId,
      fhevmAclAddress: aclAddr,
      fhevmKmsVerifierAddress: kmsAddr,
      newRelayerAddress: this.newRelayer,
      relayerPrivateKey: this.config.get('ethereumPrivateKey'),
      ethereumPrivateKey: this.config.get('ethereumPrivateKey'),
      bondAmount: this.config.get('bondAmount'),
      // si tu NodeConfig tiene más campos, agregalos acá
    } as any;

    this.decryptor = new FHEDecryptor(nodeCfg, provider, wallet);

    try {
      await this.decryptor.initialize();
      const pk = this.decryptor.getPublicKey();
      if (pk) this.logger.log(`FHE decryptor ready. Public key: ${pk}`);
      else    this.logger.warn('FHE decryptor initialized without public key');
    } catch (err) {
      this.logger.warn(`FHE init error (continuing with fallback): ${err instanceof Error ? err.message : err}`);
      this.decryptor = this.decryptor ?? null;
    }
  }

  async decryptSolanaAddress(requestId: bigint, newRelayerAddress?: string): Promise<string> {
    if (!this.decryptor) throw new Error('FHE decryptor not initialized');
    return this.decryptor.decryptSolanaAddress(
      requestId,
      newRelayerAddress ?? this.newRelayer
    );
  }

  getPublicKey(): string | null {
    return this.decryptor?.getPublicKey() ?? null;
  }
}
