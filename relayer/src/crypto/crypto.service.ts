import { Injectable } from '@nestjs/common';
import { createDecipheriv, createCipheriv, randomBytes } from 'node:crypto';
import { BridgeMessageSchema } from 'src/config/config.schema';
import { BridgeMessage, computeMsgId } from 'src/message/canonical';

type DecryptedEnvelope = {
  kv: number;
  b64: string;
  msgIdHex?: string;
  message: BridgeMessage;
  recomputedMsgId: string;
};

function parseKeyring(): Map<number, Buffer> {
  const m = new Map<number, Buffer>();
  const envList = process.env.EVENT_KEYS; // formato: "1=hex,2=hex,5=hex"
  if (envList && envList.trim() !== '') {
    for (const pair of envList.split(',')) {
      const [k, v] = pair.split('=').map(s => s.trim());
      if (!k || !v) continue;
      const kv = Number(k);
      if (!Number.isFinite(kv)) continue;
      if (!/^[0-9a-fA-F]{64}$/.test(v)) continue;
      m.set(kv, Buffer.from(v, 'hex'));
    }
  }
  // fallback: kv=1 con EVENT_ENC_KEY_HEX
  if (m.size === 0) {
    const single = process.env.EVENT_ENC_KEY_HEX!;
    if (!single || !/^[0-9a-fA-F]{64}$/.test(single)) {
      throw new Error('EVENT_ENC_KEY_HEX missing/invalid and no EVENT_KEYS provided');
    }
    m.set(1, Buffer.from(single, 'hex'));
  }
  return m;
}

@Injectable()
export class CryptoService {
  private keyring = parseKeyring();

  /** AES-256-GCM base64(iv|ct|tag) -> plaintext bytes using the provided kv */
  private decryptB64WithKv(kv: number, compactB64: string): Buffer {
    const key = this.keyring.get(kv);
    if (!key) throw new Error(`No key for kv=${kv}`);
    const buf = Buffer.from(compactB64, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const data = buf.subarray(12, buf.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  /** Helper for tests: encrypt plaintext with a given kv to base64(iv|ct|tag) */
  encryptToBase64(plain: Buffer, kv = 1): string {
    const key = this.keyring.get(kv);
    if (!key) throw new Error(`No key for kv=${kv}`);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, ct, tag]).toString('base64');
  }

  /** Parse + decrypt a Solana log line.
   * Supports:
   *  - EV1:<kv>:<msgIdHex>:<b64>
   *  - EVENT:<b64> (fallback, assumes kv=1 and recomputes msgId)
   */
  parseAndDecryptFromLogLine(line: string): DecryptedEnvelope | null {
    // EV1 envelope
    if (line.startsWith('EV1:')) {
      const rest = line.slice(4);
      const parts = rest.split(':');
      if (parts.length < 3) return null;
      const kv = Number(parts[0]);
      const msgIdHex = parts[1].startsWith('0x') ? parts[1] : `0x${parts[1]}`;
      const b64 = parts.slice(2).join(':').trim(); // por si b64 contiene ':'

      const plain = this.decryptB64WithKv(kv, b64);
      const json = JSON.parse(plain.toString('utf8'));
      const parsed = BridgeMessageSchema.parse(json); // valida y normaliza
      const recomputed = computeMsgId(parsed);
      return {
        kv,
        b64,
        msgIdHex: msgIdHex.toLowerCase(),
        message: parsed,
        recomputedMsgId: recomputed.toLowerCase(),
      };
    }

    // Fallback: EVENT:<b64>
    const i = line.indexOf('EVENT:');
    if (i >= 0) {
      const b64 = line.slice(i + 6).trim();
      const kv = 1;
      const plain = this.decryptB64WithKv(kv, b64);
      const json = JSON.parse(plain.toString('utf8'));
      const parsed = BridgeMessageSchema.parse(json);
      const recomputed = computeMsgId(parsed);
      return {
        kv,
        b64,
        message: parsed,
        recomputedMsgId: recomputed.toLowerCase(),
      };
    }

    return null;
  }
}
