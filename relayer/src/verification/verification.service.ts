import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly eth: EthService,
    private readonly sol: SolService,
    private readonly e2sRepo: EvmToSolRepository,
    private readonly s2eRepo: SolToEvmRepository,
  ) {}

  /**
   * EVM -> SOL flow:
   * 1) Persist "received"
   * 2) Verify arrival on Solana (destination leg)
   * 3) Precheck EVM state (exists, not finalized, active claim, not expired)
   * 4) Settle on EVM (verifyAndSettle)
   */
  async handleEvmToSol(dto: EvmToSolVerificationDto) {
    // 1) Persist the “RECEIVED” record for auditing and idempotency
    await this.e2sRepo.upsertReceived({
      requestId: dto.requestId,
      tokenEvm: dto.token,
      amountEvm: dto.amount,
      ethClaimTxHash: dto.ethClaimTxHash,
      solanaSignature: dto.solanaTransferSignature,
      solanaRecipient: dto.solanaDestination,
      evidenceURL: dto.evidenceURL,
    });

    // 2) Basic request validation
    if (!dto.solanaTransferSignature) {
      await this.e2sRepo.markFailed(dto.requestId, 'Missing Solana signature');
      throw new BadRequestException('Missing Solana signature');
    }
    if (!dto.solanaDestination) {
      await this.e2sRepo.markFailed(dto.requestId, 'Missing Solana destination');
      throw new BadRequestException('Missing Solana destination');
    }

    let evmAmt: bigint;
    try {
      evmAmt = BigInt(dto.amount);
    } catch {
      await this.e2sRepo.markFailed(dto.requestId, 'Invalid amount format');
      throw new BadRequestException('Invalid amount format');
    }
    if (evmAmt <= 0n) {
      await this.e2sRepo.markFailed(dto.requestId, 'Amount must be greater than 0');
      throw new BadRequestException('Amount must be greater than 0');
    }

    // 3) Resolve ERC20→SPL mapping and convert EVM units → SPL units
    const mapping = findTokenInfo(dto.token);
    if (!mapping) {
      const msg = 'Unknown ERC20→SPL mapping. Configure TOKEN_USDC / TOKEN_SOL (and decimals) in env.';
      await this.e2sRepo.markFailed(dto.requestId, msg);
      throw new BadRequestException(msg);
    }
    if (!mapping.sol.mint) {
      await this.e2sRepo.markFailed(dto.requestId, 'Missing SPL mint in token mapping');
      throw new BadRequestException('Missing SPL mint in token mapping');
    }

    const { solAmount, mint } = adjustToSolDecimals(evmAmt, mapping);
    this.logger.log(
      `[EVM->SOL] amount(evmunits)=${evmAmt} (${mapping.evm.decimals}) → amount(splunits)=${solAmount} (${mapping.sol.decimals}) | mint=${mint}`,
    );

    // 4) Verify the Solana leg (recipient balance delta in the correct SPL mint)
    try {
      await this.sol.verifyTransfer({
        signature: dto.solanaTransferSignature,
        recipient: dto.solanaDestination,
        amount: solAmount,
        mint, // must match the SPL mint actually transferred
      });
    } catch (e: any) {
      const msg = `[EVM->SOL] Solana transfer verification failed: ${e?.message ?? e}`;
      this.logger.warn(msg);
      await this.e2sRepo.markFailed(dto.requestId, msg);
      throw new BadRequestException(msg);
    }

    // 5) Derive settlement evidence for the EVM contract call
    const requestId = BigInt(dto.requestId);
    const destTxHash = ethers.keccak256(ethers.toUtf8Bytes(dto.solanaTransferSignature));
    const evidenceHash = ethers.keccak256(
      ethers.toUtf8Bytes(`${dto.token}|${dto.amount}|${dto.solanaDestination}`),
    );

    // 6) Pre-check EVM state to avoid opaque on-chain reverts
    const br = await this.eth.getBridgeRequest(requestId);
    console.log(br);
    if (!br || br.sender === ethers.ZeroAddress) {
      const msg = 'Bridge request not found on EVM';
      await this.e2sRepo.markFailed(dto.requestId, msg);
      throw new BadRequestException(msg);
    }
    if (br.finalized) {
      const msg = 'Request is already finalized';
      await this.e2sRepo.markFailed(dto.requestId, msg);
      throw new BadRequestException(msg);
    }

    const cl = await this.eth.getClaim(requestId);
    if (!cl || cl.solver === ethers.ZeroAddress) {
      const msg = 'No active claim for this request';
      await this.e2sRepo.markFailed(dto.requestId, msg);
      throw new BadRequestException(msg);
    }
    const now = Math.floor(Date.now() / 1000);
    if (Number(cl.deadline) < now) {
      const msg = 'Claim already expired';
      await this.e2sRepo.markFailed(dto.requestId, msg);
      throw new BadRequestException(msg);
    }

    // 7) Mark “VERIFIED” off-chain to complete bookkeeping
    await this.e2sRepo.markVerified(dto.requestId, {
      destTxHash,
      evidenceHash,
      tokenSolMint: mint,
      amountSol: solAmount.toString(),
    });

    // 8) Settle on EVM by calling the relayer-only verifyAndSettle
    try {
      const receipt = await this.eth.verifyAndSettle(
        requestId,
        destTxHash,
        evidenceHash,
        dto.evidenceURL, // pass undefined to use the no-URL overload
      );
      await this.e2sRepo.markSettled(dto.requestId, receipt?.transactionHash);
      return { verified: true, ethTx: receipt?.transactionHash };
    } catch (e) {
      await this.e2sRepo.markFailed(dto.requestId, e);
      throw e;
    }
  }


  /**
   * SOL -> EVM flow:
   * 1) Persist "received"
   * 2) Verify deposit into Solana vault
   * 3) Precheck EVM capability (bridge balance, sane recipient/token)
   * 4) Deliver on EVM
   */
  async handleSolToEvm(dto: SolToEvmVerificationDto) {
    await this.s2eRepo.upsertReceived({
      requestId: dto.requestId,
      solanaDepositSignature: dto.solanaDepositSignature,
      solanaVault: dto.solanaVault,
      solanaMint: dto.solanaMint ?? '',
      amountSol: dto.amount,
      evmRecipient: dto.evmRecipient,
      evmToken: dto.evmToken,
    });

    if (!ethers.isAddress(dto.evmRecipient)) {
      await this.s2eRepo.markFailed(dto.requestId, 'Invalid EVM recipient');
      throw new BadRequestException('Invalid EVM recipient');
    }
    if (!ethers.isAddress(dto.evmToken)) {
      await this.s2eRepo.markFailed(dto.requestId, 'Invalid EVM token address');
      throw new BadRequestException('Invalid EVM token address');
    }

    // 1) Verificar el depósito en Solana (lock en vault)
    await this.sol.verifyDeposit({
      signature: dto.solanaDepositSignature,
      vault: dto.solanaVault,
      amount: BigInt(dto.amount),
      mint: dto.solanaMint,
    });

    // 2) Marcar VERIFIED off-chain
    await this.s2eRepo.markVerified(dto.requestId);

    // 3) Convertir unidades SOL -> EVM según mapping
    const mapping = findTokenInfo(dto.evmToken) ?? {
      name: 'Unknown',
      evm: { address: dto.evmToken as `0x${string}`, decimals: 18 },
      sol: { mint: dto.solanaMint ?? '', decimals: 9 },
    };
    const { evmAmount } = adjustToEvmDecimals(BigInt(dto.amount), mapping);

    // 4) Prechecks lado EVM
    const contractBal = await this.eth.getContractTokenBalance(dto.evmToken as `0x${string}`);
    if (contractBal < evmAmount) {
      const msg = `Insufficient bridge balance on EVM (${contractBal} < ${evmAmount})`;
      await this.s2eRepo.markFailed(dto.requestId, msg);
      throw new BadRequestException(msg);
    }
    if (evmAmount <= 0n) {
      await this.s2eRepo.markFailed(dto.requestId, 'Amount must be greater than 0');
      throw new BadRequestException('Amount must be greater than 0');
    }

    // 5) Entregar en EVM y verificar por logs Transfer antes de cerrar en Solana
    try {
      const receipt = await this.eth.deliverTokens(
        dto.evmRecipient as `0x${string}`,
        dto.evmToken as `0x${string}`,
        evmAmount,
      );

      // 5.a) Verificar entrega EVM (logs Transfer(to, amount) del token)
      try {
        await this.eth.verifyEvmDelivery({
          txHash: receipt?.transactionHash as `0x${string}`,
          token: dto.evmToken as `0x${string}`,
          to: dto.evmRecipient as `0x${string}`,
          amount: evmAmount,
          minConfirmations: Number(process.env.ETH_MIN_CONFIRMATIONS ?? 1),
        });
        this.logger.log(
          `[SOL->EVM] EVM delivery verified: req=${dto.requestId} tx=${receipt?.transactionHash}`
        );
      } catch (e: any) {
        const msg = `[SOL->EVM] EVM delivery verification failed: ${e?.message ?? e}`;
        this.logger.warn(msg);
        await this.s2eRepo.markFailed(dto.requestId, msg);
        throw new BadRequestException(msg);
      }

      // 6) Cerrar del lado Solana (verify_and_settle) SOLO si la entrega EVM fue verificada
      try {
        const evmTransferTxHash = receipt?.transactionHash as `0x${string}`;

        // Derivar ATA del vault si hay SPL; si es SOL nativo, usar vault como fallback
        let escrowTokenB58 = dto.solanaVault;
        const mintB58 = dto.solanaMint ?? mapping.sol.mint ?? '';
        if (mintB58) {
          const ata = await getAssociatedTokenAddress(
            new PublicKey(mintB58),
            new PublicKey(dto.solanaVault),
            true, // owner off-curve (PDA)
          );
          escrowTokenB58 = ata.toBase58();
        }

        const payer      = process.env.SOLANA_RELAYER_PUBKEY || dto.solanaVault;
        const mxeAccount = process.env.SOLANA_MXE_PDA!;
        const feePool    = process.env.SOLANA_FEE_POOL!;
        const clock      = process.env.SOLANA_CLOCK!;

        const settleRes = await this.sol.verifyAndSettleOnSolana({
          requestId: dto.requestId,
          evmTransferTxHash,
          accounts: {
            payer,
            escrowOwner: dto.solanaVault,
            escrowToken: escrowTokenB58,
            mint: mintB58 || '11111111111111111111111111111111',
            mxeAccount,
            feePool,
            clock,
          },
        });

        this.logger.log(
          `[SOL->EVM] Solana verify_and_settle ok: req=${dto.requestId} sig=${settleRes.signature}`
        );
      } catch (e: any) {
        const msg = `[SOL->EVM] verify_and_settle on Solana failed: ${e?.message ?? e}`;
        this.logger.warn(msg);
        await this.s2eRepo.markFailed(dto.requestId, msg);
        throw new BadRequestException(msg);
      }

      // 7) Persistir SETTLED con tx de EVM
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
