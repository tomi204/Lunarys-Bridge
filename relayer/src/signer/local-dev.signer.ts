// src/signer/local-dev.signer.ts
import { Injectable } from '@nestjs/common';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { pinoLogger as logger } from 'src/common/logger';
import { AttestationProvider, Attestation } from './types';

function normalizePk(raw?: string): Hex {
  if (!raw) throw new Error('LOCAL_SIGNER_PK not set');

  // quita comillas y espacios invisibles
  const rawPk = raw.trim().replace(/^["']|["']$/g, '');

  // valida 0x + 64 hex (32 bytes)
  const ok = /^0x[0-9a-fA-F]{64}$/.test(rawPk);
  if (!ok) {
    const hint = `${rawPk.slice(0, 6)}...${rawPk.slice(-4)} (len=${rawPk.length})`;
    throw new Error(
      `LOCAL_SIGNER_PK must be 0x + 64 hex chars (32 bytes). Got ${hint}`
    );
  }

  return rawPk as Hex;
}

@Injectable()
export class LocalDevSigner implements AttestationProvider {
  private readonly account = (() => {
    const pk = normalizePk(process.env.LOCAL_SIGNER_PK);
    const acc = privateKeyToAccount(pk);
    logger.info({ addr: acc.address }, 'Dev signer ready');
    return acc;
  })();

  async signDigest(digest: Hex): Promise<Attestation> {
    // firma el hash crudo (sin prefijo EIP-191)
    const signature = await this.account.sign({ hash: digest });
    const bytes = Buffer.from(signature.slice(2), 'hex');
    const r = `0x${bytes.subarray(0, 32).toString('hex')}` as Hex;
    const s = `0x${bytes.subarray(32, 64).toString('hex')}` as Hex;
    let v = bytes[64];
    if (v < 27) v += 27;
    return { v, r, s };
  }
}
