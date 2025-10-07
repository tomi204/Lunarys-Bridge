// src/signer/arcium.signer.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { pinoLogger as logger } from 'src/common/logger';
import { AttestationProvider, Attestation } from './types';

function isLikelySolanaRpc(url: string) {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return (
      h.includes('helius-rpc.com') ||
      h.includes('quicknode') ||
      h.includes('solana') ||
      h.includes('alchemy') // Alchemy Solana RPC
    );
  } catch {
    return false;
  }
}

function normalizePk(raw?: string): Hex {
  if (!raw) throw new Error('LOCAL_SIGNER_PK not set (fallback signer required)');
  // strip quotes/spaces
  const pk = raw.trim().replace(/^["']|["']$/g, '');
  // strict 0x + 64 hex chars (32 bytes)
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    const hint = `${pk.slice(0, 6)}...${pk.slice(-4)} (len=${pk.length})`;
    throw new Error(`LOCAL_SIGNER_PK must be 0x + 64 hex chars (32 bytes). Got ${hint}`);
  }
  return pk as Hex;
}

async function signWithLocalPk(digest: Hex, pk: Hex): Promise<Attestation> {
  const acc = privateKeyToAccount(pk);
  // Sign raw digest (no EIP-191 prefix)
  const signature = await acc.sign({ hash: digest });
  const bytes = Buffer.from(signature.slice(2), 'hex');
  const r = `0x${bytes.subarray(0, 32).toString('hex')}` as Hex;
  const s = `0x${bytes.subarray(32, 64).toString('hex')}` as Hex;
  let v = bytes[64];
  if (v < 27) v += 27;
  return { v, r, s };
}

@Injectable()
export class ArciumSigner implements AttestationProvider {
  private readonly url = process.env.ARCIUM_API_URL;

  constructor() {
    if (!this.url) throw new Error('ARCIUM_API_URL not set');
  }

  /**
   * Attestation provider for Arcium.
   *
   * - If ARCIUM_API_URL looks like a Solana RPC => log and fallback to local signer.
   *   (Real Arcium MXE is invoked on-chain; the relayer does not call MPC over HTTP.)
   *
   * - If ARCIUM_API_URL points to a custom REST endpoint that returns {v,r,s},
   *   we try it first. If it fails or does not return v/r/s, fallback to local signer.
   */
  async signDigest(digest: Hex): Promise<Attestation> {
    // Try a custom REST endpoint first (if it’s not a Solana RPC)
    if (!isLikelySolanaRpc(this.url!)) {
      try {
        // Adjust path/body to match your actual service when available.
        const res = await axios.post(
          this.url!,
          { method: 'arcium_attestDigest', params: [{ digest }] },
          { timeout: Number(process.env.ARCIUM_TIMEOUT_MS ?? 15000) }
        );
        const data = res.data?.result ?? res.data;
        if (data?.v && data?.r && data?.s) {
          logger.info({ digest }, 'Arcium REST attestation OK');
          return { v: Number(data.v), r: data.r as Hex, s: data.s as Hex };
        }
        logger.warn({ data }, 'Arcium REST response missing v/r/s; falling back to local signer');
      } catch (e: any) {
        logger.warn({ err: e?.message }, 'Arcium REST call failed; falling back to local signer');
      }
    } else {
      // Solana RPC detected: the canonical way is on-chain MXE invocation.
      logger.info(
        { url: this.url },
        'Solana RPC detected. Arcium MXE is on-chain; relayer will use LOCAL_SIGNER_PK for dev fallback.'
      );
    }

    // Fallback: local dev signer so you can keep the pipeline working
    const pk = normalizePk(process.env.LOCAL_SIGNER_PK);
    const sig = await signWithLocalPk(digest, pk);
    logger.info({ addr: privateKeyToAccount(pk).address }, 'Fallback dev signer used for attestation');
    return sig;
  }
}
