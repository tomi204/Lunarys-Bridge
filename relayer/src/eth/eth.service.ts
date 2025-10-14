import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { NEW_RELAYER_ABI } from 'src/common/config/abi/newRelayer';

type BridgeRequestView = {
  sender: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  timestamp: number;
  finalized: boolean;
  fee: bigint;
};

type ClaimView = {
  solver: `0x${string}`;
  claimedAt: number;
  deadline: number;
  bond: bigint;
};

@Injectable()
export class EthService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  constructor(cfg: ConfigService) {
    const rpc = cfg.get<string>('ETHEREUM_RPC_URL')!;
    const pk  = cfg.get<string>('RELAYER_PRIVATE_KEY')!;
    const addr = cfg.get<string>('NEW_RELAYER_ADDRESS')!;

    this.provider = new ethers.JsonRpcProvider(rpc);
    this.wallet = new ethers.Wallet(pk, this.provider);
    this.contract = new ethers.Contract(addr, NEW_RELAYER_ABI, this.wallet);
  }

  // -------- Write calls --------

  async verifyAndSettle(requestId: bigint, destTxHash: string, evidenceHash: string, evidenceURL?: string) {
    if (evidenceURL) {
      const tx = await this.contract.verifyAndSettle(requestId, destTxHash, evidenceHash, evidenceURL);
      return tx.wait();
    }
    const tx = await this.contract.verifyAndSettle(requestId, destTxHash, evidenceHash);
    return tx.wait();
  }

  async deliverTokens(recipient: `0x${string}`, token: `0x${string}`, amount: bigint) {
    const tx = await this.contract.deliverTokens(recipient, token, amount);
    return tx.wait();
  }

  // -------- Read helpers (prechecks) --------

  async getBridgeRequest(requestId: bigint): Promise<BridgeRequestView | null> {
    try {
      const br = await this.contract.getBridgeRequest(requestId);
      // struct BridgeRequest {
      //   address sender; address token; uint256 amount; euint256 encryptedSolanaDestination;
      //   uint256 timestamp; bool finalized; uint256 fee;
      // }
      return {
        sender: br.sender,
        token: br.token,
        amount: BigInt(br.amount),
        timestamp: Number(br.timestamp),
        finalized: Boolean(br.finalized),
        fee: BigInt(br.fee),
      };
    } catch {
      return null;
    }
  }

  async getClaim(requestId: bigint): Promise<ClaimView | null> {
    try {
      const c = await this.contract.requestClaim(requestId);
      // struct Claim { address solver; uint64 claimedAt; uint64 deadline; uint256 bond; }
      return {
        solver: c.solver,
        claimedAt: Number(c.claimedAt),
        deadline: Number(c.deadline),
        bond: BigInt(c.bond),
      };
    } catch {
      return null;
    }
  }

  async getContractTokenBalance(token: `0x${string}`): Promise<bigint> {
    try {
      const bal: bigint = await this.contract.getContractBalance(token);
      return bal;
    } catch {
      // If view fails (shouldn't), return 0 to force a safe failure upstream
      return 0n;
    }
  }
}
