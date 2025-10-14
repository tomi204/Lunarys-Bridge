import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { EvmToSolVerificationDto } from 'src/verification/dto/evm-to-sol.dto';
import { SolToEvmVerificationDto } from 'src/verification/dto/sol-to-evm.dto';
import { ApiTokenGuard } from 'src/common/guards/api-token.guard';

@Controller('api')
@UseGuards(ApiTokenGuard)
export class VerificationController {
  constructor(private readonly svc: VerificationService) {}

  @Post('verify-bridge/evm-to-sol')
  async evmToSol(@Body() dto: EvmToSolVerificationDto) {
    return this.svc.handleEvmToSol(dto);
  }

  @Post('verify-bridge/sol-to-evm')
  async solToEvm(@Body() dto: SolToEvmVerificationDto) {
    return this.svc.handleSolToEvm(dto);
  }

  @Get('bridge-status/evm-to-sol/:id')
  evmToSolStatus(@Param('id') id: string) {
    return this.svc.getEvmToSolStatus(id);
  }

  @Get('bridge-status/sol-to-evm/:id')
  solToEvmStatus(@Param('id') id: string) {
    return this.svc.getSolToEvmStatus(id);
  }
}
