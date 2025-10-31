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
    const rpc  = cfg.get<string>('ETHEREUM_RPC_URL') ?? process.env.ETHEREUM_RPC_URL;
    const pk  = cfg.get<string>('RELAYER_PRIVATE_KEY') ?? process.env.RELAYER_PRIVATE_KEY;
    const addr = cfg.get<string>('NEW_RELAYER_ADDRESS') ?? process.env.NEW_RELAYER_ADDRESS;

    if (!rpc) throw new Error('ETHEREUM_RPC_URL missing');
    if (!pk) throw new Error('RELAYER_PRIVATE_KEY missing');
    if (!addr) throw new Error('NEW_RELAYER_ADDRESS missing');


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
  async verifyEvmDelivery(params: {
  txHash: string;
  token: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
  minConfirmations?: number; // default 1
}): Promise<void> {
  const ZERO_ETH_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'; // tu sentinel para "native"
  const ERC20_TRANSFER_TOPIC = (ethers as any).id
  ? (ethers as any).id('Transfer(address,address,uint256)') // ethers v6
  : '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  const { txHash, token, to, amount } = params;
  const minConf = params.minConfirmations ?? 1;

  // Si fuera native (sentinel), por ahora solo exigimos receipt OK y confirmaciones.
  if (token.toLowerCase() === ZERO_ETH_SENTINEL.toLowerCase()) {
    const rcpt = await this.provider.waitForTransaction(txHash, minConf);
    if (!rcpt) throw new Error(`No receipt for tx ${txHash}`);
    if (rcpt.status !== 1) throw new Error(`Native transfer reverted (status=${rcpt.status})`);
    return;
  }

  // ERC20: esperamos receipt con confirmaciones y chequeamos logs Transfer
  const rcpt = await this.provider.waitForTransaction(txHash, minConf);
  if (!rcpt) throw new Error(`No receipt for tx ${txHash}`);
  if (rcpt.status !== 1) throw new Error(`Tx reverted (status=${rcpt.status})`);

  // filtrar logs del token + tópico Transfer
  const logs = (rcpt.logs ?? []).filter(
    (l: any) =>
      (l.address?.toLowerCase?.() === token.toLowerCase()) &&
      (l.topics?.[0] === ERC20_TRANSFER_TOPIC),
  );

  if (!logs.length) {
    throw new Error(`No ERC20 Transfer logs for token ${token} in tx ${txHash}`);
  }

  // decodificar y buscar Transfer(..., to, amount)
  // ethers v6: Interface minimal para Transfer
  const iface = new ethers.Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  ]);

  const ok = logs.some((l: any) => {
    try {
      const decoded = iface.decodeEventLog('Transfer', l.data, l.topics);
      const toMatch = String(decoded.to).toLowerCase() === to.toLowerCase();
      // decoded.value en v6 suele venir como bigint
      const val = BigInt(decoded.value);
      const amtMatch = val === amount;
      return toMatch && amtMatch;
    } catch {
      return false;
    }
  });

  if (!ok) {
    throw new Error(
      `ERC20 Transfer(to=${to}, amt=${amount}) not found in tx ${txHash}`,
    );
  }
}

}
