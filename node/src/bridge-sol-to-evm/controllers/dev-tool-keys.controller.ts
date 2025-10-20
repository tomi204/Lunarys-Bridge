import { Controller, Get, NotFoundException } from '@nestjs/common';
import { SolverKeyToolService } from '../services/solver-key-tool.service';

/**
 * Dev-only endpoints to help operators generate keys.
 * Guarded by ALLOW_DEV_TOOLS=1
 */
@Controller('dev')
export class DevToolsController {
  constructor(private readonly tool: SolverKeyToolService) {}

  @Get('solver-key/generate')
  generateSolverKey() {
    // Safety: you must not enable this in production
    if (process.env.ALLOW_DEV_TOOLS !== '1') {
      throw new NotFoundException(); // pretend it doesn't exist
    }
    return this.tool.generatePair();
  }
}
