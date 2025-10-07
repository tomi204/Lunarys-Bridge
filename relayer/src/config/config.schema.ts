// src/config/config.schema.ts
import { z } from 'zod';
import type { Hex } from 'viem';
import type { BridgeMessage } from 'src/message/canonical';

// helpers
const wsUrl = z.string().refine(s => { try { const u = new URL(s); return u.protocol === 'ws:' || u.protocol === 'wss:'; } catch { return false; } }, 'must be ws(s) URL');
const httpUrl = z.string().refine(s => { try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } }, 'must be http(s) URL');
const base58Re = /^[1-9A-HJ-NP-Za-km-z]+$/;
const ethAddrRe = /^0x[a-fA-F0-9]{40}$/;
const hexPkRe  = /^0x[0-9a-fA-F]{64}$/;

// ENV schema
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development','production','test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  // Solana WS (logsSubscribe)
  TRITON_WS_URL: wsUrl,
  SOLANA_PROGRAM_ID: z.string().min(32).max(44).regex(base58Re),

  // Encrypted events
  EVENT_ENC_KEY_HEX: z.string().regex(/^[0-9a-fA-F]{64}$/, 'must be 32-byte hex'),
  EVENT_KEYS: z.string().optional(), // "1=hex,2=hex,..."

  // Ethereum RPC
  ETH_RPC_WSS: wsUrl,
  ETH_RPC_HTTP: httpUrl.optional(),
  ETH_CHAIN_ID: z.coerce.number().int().positive().default(11155111),
  ETH_LOCKER_ADDR: z.preprocess(v => (typeof v==='string' && v.trim()==='' ? undefined : v), z.string().regex(ethAddrRe).optional()),

  // EVM submit (opcionales; si faltan, no se envía)
  EXECUTOR_ADDR: z.string().regex(ethAddrRe).optional(),
  EVM_RELAYER_PK: z.string().regex(hexPkRe).optional(),
  LOCAL_SIGNER_PK: z.string().regex(hexPkRe).optional(), // fallback signer dev

  // Solana submit (opcionales; si faltan, no se envía)
  SOLANA_RPC_HTTP: httpUrl.optional(),
  SOLANA_EXECUTOR_PROGRAM_ID: z.string().min(32).max(44).regex(base58Re).optional(),
  SOLANA_PAYER_SECRET: z.string().optional(), // base58 o JSON array

  // Arcium
  ARCIUM_API_URL: z.string().url().optional(),
  ARCIUM_TIMEOUT_MS: z.coerce.number().int().positive().optional(),

  // Solana commitment
  CONFIRM_SOL_COMMITMENT: z.enum(['processed','confirmed','finalized']).default('confirmed'),
});
export type EnvVars = z.infer<typeof EnvSchema>;

// BridgeMessage schema
const hex32 = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'must be 0x + 32 bytes hex').transform(s => s as Hex);
export const BridgeMessageSchema: z.ZodType<BridgeMessage> = z.object({
  version: z.number().int().min(0).max(255),
  dir: z.number().int().min(0).max(255),
  srcChainId: z.string().regex(/^\d+$/).transform(BigInt),
  dstChainId: z.string().regex(/^\d+$/).transform(BigInt),
  srcTxId: hex32,
  originToken: hex32,
  amount: z.string().regex(/^\d+$/).transform(BigInt),
  recipient: hex32,
  nonce: z.string().regex(/^\d+$/).transform(BigInt),
  expiry: z.string().regex(/^\d+$/).transform(BigInt),
}).strict();
