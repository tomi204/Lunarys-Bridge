declare module 'fhevmjs/node' {
  export interface FhevmInstance {
    createEIP712: (publicKey: string, verifyingContract: string) => any;
    getPublicKey: (verifyingContract: string) => Promise<any>;
    generateKeypair: () => { publicKey: string; privateKey: string };
    reencrypt: (
      handle: bigint,
      privateKey: string,
      publicKey: string,
      signature: string,
      contractAddress: string,
      userAddress: string
    ) => Promise<bigint>;
  }

  export function createInstance(params: {
    chainId: number;
    networkUrl?: string;
    publicKey?: string;
    gatewayUrl?: string;
  }): Promise<FhevmInstance>;
}
