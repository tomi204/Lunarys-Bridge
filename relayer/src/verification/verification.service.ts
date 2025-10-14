import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ethers } from 'ethers';
import { EthService } from 'src/eth/eth.service';
import { SolService } from 'src/sol/sol.service';
import {
  findTokenInfo,
  adjustToSolDecimals,
  adjustToEvmDecimals,
} from 'src/common/config/token-mapping';
import { EvmToSolVerificationDto } from './dto/evm-to-sol.dto';
import { SolToEvmVerificationDto } from './dto/sol-to-evm.dto';
import { EvmToSolRepository } from 'src/common/repositories/evm-to-sol.repository';
import { SolToEvmRepository } from 'src/common/repositories/sol-to-evm.repository';

@Injectable()
export class VerificationService {
  constructor(
    private readonly eth: EthService,
    private readonly sol: SolService,
    private readonly e2sRepo: EvmToSolRepository,
    private readonly s2eRepo: SolToEvmRepository,
  ) {}

  /**
   * EVM -> SOL:
   * 1) Persist "received"
   * 2) Verify arrival on Solana (destination leg)
   * 3) Precheck EVM state (request exists, not finalized, active claim, not expired)
   * 4) Settle on EVM (verifyAndSettle)
   */
  async handleEvmToSol(dto: EvmToSolVerificationDto) {
    // 1) persist RECEIVED
    await this.e2sRepo.upsertReceived({
      requestId: dto.requestId,
      tokenEvm: dto.token,
      amountEvm: dto.amount,
      ethClaimTxHash: dto.ethClaimTxHash,
      solanaSignature: dto.solanaTransferSignature,
      solanaRecipient: dto.solanaDestination,
      evidenceURL: dto.evidenceURL,
    });

    // 2) decimals adjust EVM -> SOL
    const info = findTokenInfo(dto.token) ?? {
      name: 'Unknown',
      evm: { address: dto.token as `0x${string}`, decimals: 18 },
      sol: { mint: '', decimals: 9 },
    };
    const evmAmt = BigInt(dto.amount);
    const { solAmount, mint } = adjustToSolDecimals(evmAmt, info);

    // Sanity checks (client data)
    if (!dto.solanaTransferSignature) {
      await this.e2sRepo.markFailed(dto.requestId, 'Missing Solana signature');
      throw new BadRequestException('Missing Solana signature');
    }
    if (!dto.solanaDestination) {
      await this.e2sRepo.markFailed(dto.requestId, 'Missing Solana destination');
      throw new BadRequestException('Missing Solana destination');
    }

    // 3) verify arrival on Solana
    await this.sol.verifyTransfer({
      signature: dto.solanaTransferSignature,
      recipient: dto.solanaDestination,
      amount: solAmount,
      mint,
    });

    // 4) compute hashes for EVM settlement
    const requestId = BigInt(dto.requestId);
    const destTxHash = ethers.keccak256(
      ethers.toUtf8Bytes(dto.solanaTransferSignature),
    );
    const evidenceHash = ethers.keccak256(
      ethers.toUtf8Bytes(`${dto.token}|${dto.amount}|${dto.solanaDestination}`),
    );

    // Precheck EVM state to avoid on-chain revert with opaque messages.
    const br = await this.eth.getBridgeRequest(requestId);
    if (!br || br.sender === ethers.ZeroAddress) {
      await this.e2sRepo.markFailed(dto.requestId, 'Bridge request not found on EVM');
      throw new BadRequestException('Bridge request not found on EVM');
    }
    if (br.finalized) {
      await this.e2sRepo.markFailed(dto.requestId, 'Request is already finalized');
      throw new BadRequestException('Request is already finalized');
    }

    const cl = await this.eth.getClaim(requestId);
    if (!cl || cl.solver === ethers.ZeroAddress) {
      await this.e2sRepo.markFailed(dto.requestId, 'No active claim for this request');
      throw new BadRequestException('No active claim for this request');
    }

    const now = Math.floor(Date.now() / 1000);
    if (Number(cl.deadline) < now) {
      await this.e2sRepo.markFailed(dto.requestId, 'Claim already expired');
      throw new BadRequestException('Claim already expired');
    }

    // 5) mark VERIFIED (off-chain bookkeeping)
    await this.e2sRepo.markVerified(dto.requestId, {
      destTxHash,
      evidenceHash,
      tokenSolMint: mint ?? '',
      amountSol: solAmount.toString(),
    });

    // 6) settle on EVM
    try {
      const receipt = await this.eth.verifyAndSettle(
        requestId,
        destTxHash,
        evidenceHash,
        dto.evidenceURL,
      );
      await this.e2sRepo.markSettled(dto.requestId, receipt?.transactionHash);
      return { verified: true, ethTx: receipt?.transactionHash };
    } catch (e) {
      await this.e2sRepo.markFailed(dto.requestId, e);
      throw e;
    }
  }

  /**
   * SOL -> EVM:
   * 1) Persist "received"
   * 2) Verify deposit into Solana vault (source leg)
   * 3) Precheck EVM capability (contract has enough balance; recipient/token sane)
   * 4) Deliver on EVM (deliverTokens)
   */
  async handleSolToEvm(dto: SolToEvmVerificationDto) {
    // 1) persist RECEIVED
    await this.s2eRepo.upsertReceived({
      requestId: dto.requestId,
      solanaDepositSignature: dto.solanaDepositSignature,
      solanaVault: dto.solanaVault,
      solanaMint: dto.solanaMint ?? '',
      amountSol: dto.amount,
      evmRecipient: dto.evmRecipient,
      evmToken: dto.evmToken,
    });

    // Sanity checks (client data)
    if (!ethers.isAddress(dto.evmRecipient)) {
      await this.s2eRepo.markFailed(dto.requestId, 'Invalid EVM recipient');
      throw new BadRequestException('Invalid EVM recipient');
    }
    if (!ethers.isAddress(dto.evmToken)) {
      await this.s2eRepo.markFailed(dto.requestId, 'Invalid EVM token address');
      throw new BadRequestException('Invalid EVM token address');
    }

    // 2) verify deposit on Solana
    await this.sol.verifyDeposit({
      signature: dto.solanaDepositSignature,
      vault: dto.solanaVault,
      amount: BigInt(dto.amount),
      mint: dto.solanaMint,
      // programId: 'AfaF8Qe6ZR9kiGhBzJjuyLp6gmBwc7gZBivGhHzxN1by', // optional assert your program id was invoked
    });

    // 3) mark VERIFIED
    await this.s2eRepo.markVerified(dto.requestId);

    // 4) decimals adjust SOL -> EVM
    const info = findTokenInfo(dto.evmToken) ?? {
      name: 'Unknown',
      evm: { address: dto.evmToken as `0x${string}`, decimals: 18 },
      sol: { mint: dto.solanaMint ?? '', decimals: 9 },
    };
    const { evmAmount } = adjustToEvmDecimals(BigInt(dto.amount), info);

    // EVM-side prechecks before calling deliverTokens to avoid revert:
    // - Ensure contract holds enough balance of the ERC20
    const contractBal = await this.eth.getContractTokenBalance(dto.evmToken as `0x${string}`);
    if (contractBal < evmAmount) {
      const msg = `Insufficient bridge balance on EVM (${contractBal} < ${evmAmount})`;
      await this.s2eRepo.markFailed(dto.requestId, msg);
      throw new BadRequestException(msg);
    }

    // - Token non-zero and amount > 0 (the contract enforces this; we precheck for clarity)
    if (evmAmount <= 0n) {
      await this.s2eRepo.markFailed(dto.requestId, 'Amount must be greater than 0');
      throw new BadRequestException('Amount must be greater than 0');
    }

    // 5) deliver on EVM
    try {
      const receipt = await this.eth.deliverTokens(
        dto.evmRecipient as `0x${string}`,
        dto.evmToken as `0x${string}`,
        evmAmount,
      );
      await this.s2eRepo.markSettled(dto.requestId, receipt?.transactionHash, {
        amountEvm: evmAmount.toString(),
      });
      return { delivered: true, ethTx: receipt?.transactionHash };
    } catch (e) {
      await this.s2eRepo.markFailed(dto.requestId, e);
      throw e;
    }
  }

  async getEvmToSolStatus(id: string) {
    const rec = await this.e2sRepo.getByRequest(id);
    if (!rec) throw new NotFoundException('EVM->SOL record not found');
    return rec;
  }

  async getSolToEvmStatus(id: string) {
    const rec = await this.s2eRepo.getByRequest(id);
    if (!rec) throw new NotFoundException('SOL->EVM record not found');
    return rec;
  }
}

