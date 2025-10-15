import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { NodeConfig } from 'src/types/node-config';

export interface VerificationRequest {
  requestId: string;
  ethClaimTxHash: string;
  solanaTransferSignature: string;
  solanaDestination: string;
  amount: string;
  token: string;
  evidenceURL?: string;
}
export interface VerificationResponse {
  success: boolean;
  message: string;
  verified?: boolean;
}

@Injectable()
export class RelayerApiService implements OnModuleInit {
  private readonly logger = new Logger(RelayerApiService.name);
  private readonly client: AxiosInstance | null;

  constructor(private readonly config: ConfigService<NodeConfig, true>) {
    const baseURL = this.config.get('relayerApiUrl');
    if (baseURL) {
      this.client = axios.create({
        baseURL,
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      });
      this.logger.log(`Relayer API client initialized: ${baseURL}`);
    } else {
      this.client = null;
      this.logger.warn(`RELAYER_API_URL not set; external verification disabled`);
    }
  }

  /**
   * Optional: ping relayer on module init so you see "health: OK" in logs.
   */
  async onModuleInit(): Promise<void> {
    await this.healthCheck();
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const res = await this.client.get('/health');
      if (res.status === 200) {
        this.logger.log('Relayer API health: OK');
        return true;
      }
      this.logger.warn(`Relayer API health: unexpected status ${res.status}`);
      return false;
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Unknown error';
      this.logger.warn(`Relayer API health check failed: ${msg}`);
      return false;
    }
  }

  /**
   * Submit cross-chain verification to your relayer.
   * NOTE: Your relayer exposes POST /verify-bridge/evm-to-sol (no /api prefix).
   */
  async submitVerification(request: VerificationRequest): Promise<VerificationResponse> {
    if (!this.client) {
      this.logger.warn('Skipping external verification: RELAYER_API_URL not configured');
      return { success: true, message: 'Skipped (no external relayer configured)' };
    }
    try {
      const res = await this.client.post('/api/verify-bridge/evm-to-sol', request);
      const data = res.data ?? {};
      const success = data?.verified === true || data?.success === true || res.status === 201;
      const message = data?.message ?? (success ? 'Verified by relayer' : 'Unexpected response');

      return { success, message };

    } catch (e: any) {
      this.logger.error(`Relayer submit error: ${e?.message ?? e}`);
      const msg = e?.response?.data?.message || e?.message || 'Unknown error';
      return { success: false, message: msg };
    }
  }
}
