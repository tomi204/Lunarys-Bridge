// src/submitter/evm.submitter.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createWalletClient,
  http,
  webSocket,
  Hex,
  Address,
  padHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { EnvVars } from 'src/config/config.schema';
import type { Submitter } from './types';
import { pinoLogger as logger } from 'src/common/logger';
import { encodeCanonical } from 'src/message/canonical';

/**
 * Minimal ABI for the BridgeExecutor. Adjust the function name/signature
 * to match your actual contract if it differs.
 *
 * function process(
 *   bytes32 msgId,
 *   bytes   payload,  // canonical message encoding
 *   uint8   v,
 *   bytes32 r,
 *   bytes32 s
 * ) returns (bool)
 */
const EXECUTOR_ABI = [
  {
    type: 'function',
    name: 'process',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'msgId', type: 'bytes32' },
      { name: 'payload', type: 'bytes' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [{ name: 'ok', type: 'bool' }],
  },
] as const;

/** Picks a private key to send the transaction:
 *  prefers EVM_RELAYER_PK; falls back to LOCAL_SIGNER_PK (dev).
 */
function pickPrivateKey(): Hex | null {
  const pk =
    (process.env.EVM_RELAYER_PK || process.env.LOCAL_SIGNER_PK || '').trim();
  return /^0x[0-9a-fA-F]{64}$/.test(pk) ? (pk as Hex) : null;
}

/** Sanity check for executor address (0x + 40 hex). */
function pickExecutor(): Address | null {
  const raw = (process.env.EXECUTOR_ADDR || '').trim();
  return /^0x[a-fA-F0-9]{40}$/.test(raw) ? (raw as Address) : null;
}

@Injectable()
export class EvmSubmitter implements Submitter {
  constructor(private readonly cfg: ConfigService<EnvVars, true>) {}

  /**
   * Sends the attested message to the EVM BridgeExecutor.
   *
   * Returns the tx hash (0x…) if a transaction is submitted, otherwise null.
   * - Only runs for SOL -> EVM direction (dir = 1).
   * - Requires EXECUTOR_ADDR and a relayer PK (EVM_RELAYER_PK or LOCAL_SIGNER_PK).
   * - Uses ETH_RPC_HTTP if provided; otherwise falls back to ETH_RPC_WSS.
   */
  async submit(input: {
    msgId: Hex;
    m: any;
    sig: { v: number; r: Hex; s: Hex };
  }): Promise<Hex | null> {
    // Only submit to EVM if direction is SOL -> EVM (dir = 1).
    if (Number(input.m.dir) !== 1) return null;

    const EXECUTOR_ADDR = pickExecutor();
    const pk = pickPrivateKey();
    if (!EXECUTOR_ADDR) {
      logger.warn(
        'EVM submit skipped: missing or invalid EXECUTOR_ADDR (set EXECUTOR_ADDR=0x...)'
      );
      return null;
    }
    if (!pk) {
      logger.warn(
        'EVM submit skipped: missing EVM_RELAYER_PK (or LOCAL_SIGNER_PK for dev)'
      );
      return null;
    }

    // Chain / RPC setup
    const ETH_CHAIN_ID = this.cfg.get('ETH_CHAIN_ID', { infer: true });
    const ETH_RPC_HTTP = (process.env.ETH_RPC_HTTP || '').trim();
    const ETH_RPC_WSS = this.cfg.get('ETH_RPC_WSS', { infer: true });

    const account = privateKeyToAccount(pk);
    const transport = ETH_RPC_HTTP ? http(ETH_RPC_HTTP) : webSocket(ETH_RPC_WSS);

    // We use a custom "chain" object so viem can sign and send without a preset.
    const chain = {
      id: ETH_CHAIN_ID,
      name: 'custom',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: {
          http: ETH_RPC_HTTP ? [ETH_RPC_HTTP] : [],
          webSocket: ETH_RPC_HTTP ? [] : [ETH_RPC_WSS],
        },
      },
    };

    const wallet = createWalletClient({ account, chain, transport });

    // Encode the canonical message as the "payload" expected by the executor.
    // If your executor expects a different format, adjust here.
    const payload = encodeCanonical(input.m);

    // Defensive logging (no secrets).
    logger.info(
      { to: EXECUTOR_ADDR, from: account.address, msgId: input.msgId },
      'Submitting bridge message to EVM executor'
    );

    // Some contracts expect addresses in bytes32 (left-padded). If you pass
    // addresses inside your canonical message, ensure you normalized them to bytes32
    // beforehand (we did with padHex at watch-time for originToken).
    // If needed again, you can: const bytes32 = padHex(addr as Hex, { size: 32 });
    // (not used here because payload is already canonical)

    // Send tx. viem will estimate gas by default.
    const txHash = await wallet.writeContract({
      address: EXECUTOR_ADDR,
      abi: EXECUTOR_ABI,
      functionName: 'process',
      args: [input.msgId, payload, input.sig.v, input.sig.r, input.sig.s],
    });

    logger.info({ txHash, msgId: input.msgId }, 'Executor.process() sent');
    return txHash;
  }
}
