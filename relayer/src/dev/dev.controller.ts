import { Body, Controller, Post } from '@nestjs/common';
import { CryptoService } from 'src/crypto/crypto.service';
import { BridgeMessageSchema } from 'src/config/config.schema';
import { computeMsgId, type BridgeMessage } from 'src/message/canonical';
import { RelayerProcessor } from 'src/relayer/relayer.processor';
import { pinoLogger as logger } from 'src/common/logger';
import type { Hex } from 'viem';

type EmitSolDto = {
  kv?: number;                 // key version, default 1
  message: BridgeMessage | any // canonical message payload (will be validated)
};

/** DEV-only endpoint to simulate a Solana encrypted log:
 *  Builds: "EV1:<kv>:<msgId>:<base64(iv|ct|tag)>"
 */
@Controller('/dev')
export class DevController {
  constructor(
    private readonly crypto: CryptoService,
    private readonly processor: RelayerProcessor,
  ) {}

  @Post('/emit-sol')
  async emitEncrypted(@Body() body: EmitSolDto) {
    const kv = Number(body?.kv ?? 1);
    const m = BridgeMessageSchema.parse(body.message);
    const msgId = computeMsgId(m) as Hex;

    // Encrypt plain JSON of the canonical message
    const plain = Buffer.from(JSON.stringify(m), 'utf8');
    const b64 = this.crypto.encryptToBase64(plain, kv);

    // Build EV1 line and feed it into the same parsing path used by Triton
    const ev1 = `EV1:${kv}:${msgId}:${b64}`;
    const env = this.crypto.parseAndDecryptFromLogLine(ev1);
    if (!env) return { ok: false, reason: 'parse failed' };

    // If msgId mismatch (shouldn’t), drop
    if (env.msgIdHex && env.msgIdHex !== env.recomputedMsgId) {
      logger.warn({ provided: env.msgIdHex, recomputed: env.recomputedMsgId }, 'msgId mismatch in DEV emit');
      return { ok: false, reason: 'msgId mismatch' };
    }

    await this.processor.handleDecryptedMessage({
      kv: env.kv,
      msgId: env.recomputedMsgId as Hex,
      m: env.message,
    });

    return { ok: true, kv, msgId, b64 };
  }
}
