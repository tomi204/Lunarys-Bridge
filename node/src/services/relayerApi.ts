import axios, { AxiosInstance } from "axios";

export interface VerificationRequest {
  requestId: string;
  ethClaimTxHash: string;
  solanaTransferSignature: string;
  solanaDestination: string;
  amount: string;
  token: string;
}

export interface VerificationResponse {
  success: boolean;
  message: string;
  verified?: boolean;
}

export class RelayerApiClient {
  private client: AxiosInstance;
  private apiBaseUrl: string;

  constructor(apiBaseUrl?: string) {
    // TODO: Set the actual relayer API URL when available
    this.apiBaseUrl =
      apiBaseUrl || process.env.RELAYER_API_URL || "http://localhost:3000/api";

    this.client = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(`Relayer API client initialized: ${this.apiBaseUrl}`);
  }

  /**
   * Submit verification request to relayer API
   * This is called after successfully transferring tokens on Solana
   * @param request The verification request data
   */
  async submitVerification(
    request: VerificationRequest
  ): Promise<VerificationResponse> {
    try {
      console.log("\n=================================");
      console.log("Submitting Verification to Relayer API");
      console.log("=================================");
      console.log(`Request ID: ${request.requestId}`);
      console.log(`ETH Claim Tx: ${request.ethClaimTxHash}`);
      console.log(`Solana Signature: ${request.solanaTransferSignature}`);
      console.log("=================================\n");

      const response = await this.client.post<VerificationResponse>(
        "/verify-bridge",
        request
      );

      if (response.data.success) {
        console.log(`✓ Verification submitted successfully!`);
        console.log(`Message: ${response.data.message}`);
      } else {
        console.log(`✗ Verification submission failed`);
        console.log(`Message: ${response.data.message}`);
      }

      return response.data;
    } catch (error) {
      console.error("Error submitting verification to relayer API:", error);

      if (axios.isAxiosError(error)) {
        return {
          success: false,
          message: error.response?.data?.message || error.message,
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check the status of a bridge request
   */
  async checkBridgeStatus(requestId: string): Promise<any> {
    try {
      const response = await this.client.get(`/bridge-status/${requestId}`);
      return response.data;
    } catch (error) {
      console.error("Error checking bridge status:", error);
      return null;
    }
  }

  /**
   * Health check for the relayer API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get("/health");
      return response.status === 200;
    } catch (error) {
      console.error("Relayer API health check failed:", error);
      return false;
    }
  }
}
