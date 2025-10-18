import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { NodeConfig } from '@/types/node-config';

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
];

export interface EvmTransferResult {
  txHash: `0x${string}`;
  success: boolean;
  error?: string;
}

@Injectable()
export class EthereumTransferService {
  private readonly logger = new Logger(EthereumTransferService.name);
  private readonly provider: ethers.Provider;
  private readonly wallet: ethers.Wallet;

  constructor(private readonly config: ConfigService<NodeConfig, true>) {
    const url = this.config.get('ethereumRpcUrl');
    const pk  = this.config.get('ethereumPrivateKey');
    this.provider = new ethers.JsonRpcProvider(url, { chainId: this.config.get('fhevmChainId'), name: 'evm' });
    this.wallet   = new ethers.Wallet(pk, this.provider);
  }

  isNative(token: string) {
    const t = token.toLowerCase();
    return t === '0x0000000000000000000000000000000000000000' || t === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  }

  async transferNative(to: `0x${string}`, amountWei: bigint): Promise<EvmTransferResult> {
    try {
      const tx = await this.wallet.sendTransaction({ to, value: amountWei });
      this.logger.log(`ETH sent: ${tx.hash}`);
      const rc = await tx.wait();
      if (!rc || rc.status !== 1) throw new Error('Native transfer reverted');
      return { txHash: tx.hash as `0x${string}`, success: true };
    } catch (e: any) {
      return { txHash: '0x' as `0x${string}`, success: false, error: e?.message || String(e) };
    }
  }

  async transferErc20(token: `0x${string}`, to: `0x${string}`, amount: bigint): Promise<EvmTransferResult> {
    try {
      const erc20 = new ethers.Contract(token, ERC20_ABI, this.wallet);
      const tx = await erc20.transfer(to, amount);
      this.logger.log(`ERC20 sent: ${tx.hash}`);
      const rc = await tx.wait();
      if (!rc || rc.status !== 1) throw new Error('ERC20 transfer reverted');
      return { txHash: tx.hash as `0x${string}`, success: true };
    } catch (e: any) {
      return { txHash: '0x' as `0x${string}`, success: false, error: e?.message || String(e) };
    }
  }
}
