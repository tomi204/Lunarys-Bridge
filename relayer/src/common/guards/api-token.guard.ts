import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private readonly cfg: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.cfg.get<string>('RELAYER_API_TOKEN');
    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const hdr = (req.headers['x-api-token'] || req.headers['authorization']) as string | string[] | undefined;
    if (!hdr) return false;

    const provided = Array.isArray(hdr) ? hdr[0] : hdr;
    const token = provided.startsWith('Bearer ') ? provided.slice(7) : provided;
    return token === required;
  }
}
