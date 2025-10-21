import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeConfig } from 'src/types/node-config';
import { x25519 } from '@arcium-hq/client';

@Injectable()
export class SolverKeyService {
  private readonly logger = new Logger(SolverKeyService.name);
  private priv!: Uint8Array; // 32 bytes
  private pub!: Uint8Array;  // 32 bytes

  constructor(private readonly cfg: ConfigService<NodeConfig, true>) {
    // Load a fixed solver private key from .env (HEX or Base64).
    // If not provided, generate an ephemeral key for development.
    const raw = (this.cfg.get<string>('solverX25519Secret') || '').trim();
    if (raw) {
      const b = this.decode(raw);
      if (b.length !== 32) throw new Error('SOLVER_X25519_SECRET must be exactly 32 bytes');
      this.priv = b;
      this.pub = x25519.getPublicKey(this.priv);
      this.logger.log('Solver X25519 loaded from .env');
    } else {
      this.priv = x25519.utils.randomSecretKey();
      this.pub = x25519.getPublicKey(this.priv);
      this.logger.warn('Solver X25519 generated on the fly (DEV)');
    }
  }

  getPrivateKey(): Uint8Array { return this.priv; }
  getPublicKey(): Uint8Array { return this.pub; }

  private decode(s: string): Uint8Array {
    // Accept 32-byte HEX or Base64
    if (/^[0-9a-fA-F]{64}$/.test(s)) {
      return Uint8Array.from(s.match(/.{1,2}/g)!.map(h => parseInt(h, 16)));
    }
    try { return Uint8Array.from(Buffer.from(s, 'base64')); } catch {}
    throw new Error('Invalid SOLVER_X25519_SECRET (expect 32-byte hex or base64)');
  }
}
