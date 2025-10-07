import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvSchema } from './config.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Validate entire .env at boot so we fail fast if something is off.
      validate: (cfg: Record<string, unknown>) => {
        const parsed = EnvSchema.safeParse(cfg);
        if (!parsed.success) {
          // eslint-disable-next-line no-console
          console.error('Invalid env:', parsed.error.flatten());
          throw new Error('Invalid environment configuration');
        }
        return parsed.data;
      },
    }),
  ],
})
export class AppConfigModule {}