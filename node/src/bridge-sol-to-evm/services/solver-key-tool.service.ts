import { Injectable, Logger } from '@nestjs/common';
import { x25519 } from '@arcium-hq/client';

/**
 * Dev-only utility to generate x25519 keypairs for the solver.
 * DO NOT expose this in production.
 */
@Injectable()
export class SolverKeyToolService {
  private readonly logger = new Logger(SolverKeyToolService.name);

  generatePair() {
    // Generate 32-byte private key and the corresponding public key
    const sk = x25519.utils.randomSecretKey(); // Uint8Array(32)
    const pk = x25519.getPublicKey(sk);        // Uint8Array(32)

    // Export in both HEX and Base64 so you can choose
    const secretHex = Buffer.from(sk).toString('hex');
    const publicHex = Buffer.from(pk).toString('hex');
    const secretB64 = Buffer.from(sk).toString('base64');
    const publicB64 = Buffer.from(pk).toString('base64');

    // Printable .env lines (choose hex OR base64 for the secret)
    const envHex = `SOLVER_X25519_SECRET=${secretHex}`;
    const envB64 = `SOLVER_X25519_SECRET=${secretB64}`;

    // Log nicely for quick copy/paste
    this.logger.warn('=== Solver x25519 (DEV TOOL) ===');
    this.logger.warn(`Secret (hex):    ${secretHex}`);
    this.logger.warn(`Public (hex):    ${publicHex}`);
    this.logger.warn(`Secret (base64): ${secretB64}`);
    this.logger.warn(`Public (base64): ${publicB64}`);
    this.logger.warn('Env (hex):  ' + envHex);
    this.logger.warn('Env (b64):  ' + envB64);
    this.logger.warn('================================');

    return {
      hex: { secret: secretHex, public: publicHex },
      base64: { secret: secretB64, public: publicB64 },
      env: {
        // choose one of these two lines for your .env:
        SOLVER_X25519_SECRET_hex: envHex,
        SOLVER_X25519_SECRET_base64: envB64,
        // placeholder - fill with the MXE x25519 public key you get from the cluster admin
        ARCIUM_MXE_X25519_PUBLIC_KEY: 'REPLACE_WITH_64_HEX_OR_BASE64',
      },
    };
  }
}
