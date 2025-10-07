import { z } from 'zod';
import type { Hex } from 'viem';
import type { BridgeMessage } from 'src/message/canonical';

// --- helpers
const wsUrl = z
  .string()
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === 'ws:' || u.protocol === 'wss:';
    } catch {
      return false;
    }
  }, 'must be ws(s) URL');

const base58Re = /^[1-9A-HJ-NP-Za-km-z]+$/;
const ethAddrRe = /^0x[a-fA-F0-9]{40}$/;

// --- ENV schema
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  // Solana WS
  TRITON_WS_URL: wsUrl,
  SOLANA_PROGRAM_ID: z.string().min(32).max(44).regex(base58Re),

  // Encrypted events
  EVENT_ENC_KEY_HEX: z.string().regex(/^[0-9a-fA-F]{64}$/, 'must be 32-byte hex'),

  // Ethereum WS
  ETH_RPC_WSS: wsUrl,
  ETH_CHAIN_ID: z.coerce.number().int().positive().default(11155111),

  ETH_LOCKER_ADDR: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().regex(ethAddrRe).optional()
  ),

  CONFIRM_SOL_COMMITMENT: z
    .enum(['processed', 'confirmed', 'finalized'])
    .default('confirmed'),
});

export type EnvVars = z.infer<typeof EnvSchema>;

// --- BridgeMessage schema (para validar/normalizar M)
const hex32 = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'must be 0x + 32 bytes hex')
  .transform((s) => s as Hex);

export const BridgeMessageSchema: z.ZodType<BridgeMessage> = z
  .object({
    version: z.number().int().min(0).max(255),
    dir: z.number().int().min(0).max(255),

    srcChainId: z.string().regex(/^\d+$/).transform((s) => BigInt(s)),
    dstChainId: z.string().regex(/^\d+$/).transform((s) => BigInt(s)),

    srcTxId: hex32,
    originToken: hex32,
    amount: z.string().regex(/^\d+$/).transform((s) => BigInt(s)),
    recipient: hex32,
    nonce: z.string().regex(/^\d+$/).transform((s) => BigInt(s)),
    expiry: z.string().regex(/^\d+$/).transform((s) => BigInt(s)),
  })
  .strict();
