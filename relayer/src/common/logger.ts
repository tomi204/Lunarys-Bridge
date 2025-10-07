import { LoggerService } from '@nestjs/common';
import pino from 'pino';

export const pinoLogger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
});

/** Simple adapter for Nest logger.
 *  Keep logs structured so we can scrape metrics later.
 */
export class PinoLogger implements LoggerService {
  log(message: string, ...args: unknown[]) { pinoLogger.info({ args }, message); }
  error(message: string, ...args: unknown[]) { pinoLogger.error({ args }, message); }
  warn(message: string, ...args: unknown[]) { pinoLogger.warn({ args }, message); }
  debug(message: string, ...args: unknown[]) { pinoLogger.debug({ args }, message); }
  verbose(message: string, ...args: unknown[]) { pinoLogger.trace({ args }, message); }
}
