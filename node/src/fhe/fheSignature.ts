import { promises as fs } from "fs";
import path from "path";
import { ethers } from "ethers";
import type {
  EIP712,
  FhevmInstance,
} from "@zama-fhe/relayer-sdk/node";

export interface GenericStringStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

export class FileStringStorage implements GenericStringStorage {
  private filePath: string;
  private cache: Record<string, string> = {};
  private loaded = false;

  constructor(filePath?: string) {
    this.filePath =
      filePath ?? path.resolve(process.cwd(), ".fhe", "signatures.json");
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      this.cache = JSON.parse(raw);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        throw error;
      }
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify({}), "utf8");
      this.cache = {};
    }

    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(
      this.filePath,
      JSON.stringify(this.cache, null, 2),
      "utf8"
    );
  }

  async getItem(key: string): Promise<string | null> {
    await this.ensureLoaded();
    return key in this.cache ? this.cache[key] : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.ensureLoaded();
    this.cache[key] = value;
    await this.persist();
  }

  async removeItem(key: string): Promise<void> {
    await this.ensureLoaded();
    if (key in this.cache) {
      delete this.cache[key];
      await this.persist();
    }
  }

  get location(): string {
    return this.filePath;
  }
}

class FhevmDecryptionSignatureStorageKey {
  #contractAddresses: `0x${string}`[];
  #userAddress: `0x${string}`;
  #key: string;

  constructor(
    instance: FhevmInstance,
    contractAddresses: string[],
    userAddress: string,
    publicKey?: string
  ) {
    if (!ethers.isAddress(userAddress)) {
      throw new TypeError(`Invalid address ${userAddress}`);
    }

    const sortedContractAddresses = (
      contractAddresses as `0x${string}`[]
    ).sort();

    const emptyEIP712 = instance.createEIP712(
      publicKey ?? ethers.ZeroAddress,
      sortedContractAddresses,
      0,
      0
    );

    const hash = ethers.TypedDataEncoder.hash(
      emptyEIP712.domain,
      {
        UserDecryptRequestVerification:
          emptyEIP712.types.UserDecryptRequestVerification,
      },
      emptyEIP712.message
    );

    this.#contractAddresses = sortedContractAddresses;
    this.#userAddress = userAddress as `0x${string}`;
    this.#key = `${userAddress}:${hash}`;
  }

  get contractAddresses(): `0x${string}`[] {
    return this.#contractAddresses;
  }

  get userAddress(): `0x${string}` {
    return this.#userAddress;
  }

  get key(): string {
    return this.#key;
  }
}

export class FhevmDecryptionSignature {
  #publicKey: string;
  #privateKey: string;
  #signature: string;
  #startTimestamp: number;
  #durationDays: number;
  #userAddress: `0x${string}`;
  #contractAddresses: `0x${string}`[];
  #eip712: EIP712;

  private constructor(parameters: {
    publicKey: string;
    privateKey: string;
    signature: string;
    startTimestamp: number;
    durationDays: number;
    userAddress: `0x${string}`;
    contractAddresses: `0x${string}`[];
    eip712: EIP712;
  }) {
    this.#publicKey = parameters.publicKey;
    this.#privateKey = parameters.privateKey;
    this.#signature = parameters.signature;
    this.#startTimestamp = parameters.startTimestamp;
    this.#durationDays = parameters.durationDays;
    this.#userAddress = parameters.userAddress;
    this.#contractAddresses = parameters.contractAddresses;
    this.#eip712 = parameters.eip712;
  }

  get privateKey(): string {
    return this.#privateKey;
  }

  get publicKey(): string {
    return this.#publicKey;
  }

  get signature(): string {
    return this.#signature;
  }

  get contractAddresses(): `0x${string}`[] {
    return this.#contractAddresses;
  }

  get startTimestamp(): number {
    return this.#startTimestamp;
  }

  get durationDays(): number {
    return this.#durationDays;
  }

  get userAddress(): `0x${string}` {
    return this.#userAddress;
  }

  toJSON() {
    return {
      publicKey: this.#publicKey,
      privateKey: this.#privateKey,
      signature: this.#signature,
      startTimestamp: this.#startTimestamp,
      durationDays: this.#durationDays,
      userAddress: this.#userAddress,
      contractAddresses: this.#contractAddresses,
      eip712: this.#eip712,
    };
  }

  isValid(): boolean {
    const expiresAt =
      this.#startTimestamp + this.#durationDays * 24 * 60 * 60;
    return Math.floor(Date.now() / 1000) < expiresAt;
  }

  async saveToStorage(
    storage: GenericStringStorage,
    instance: FhevmInstance,
    withPublicKey: boolean
  ): Promise<void> {
    try {
      const storageKey = new FhevmDecryptionSignatureStorageKey(
        instance,
        this.#contractAddresses,
        this.#userAddress,
        withPublicKey ? this.#publicKey : undefined
      );
      const value = JSON.stringify(this);
      await storage.setItem(storageKey.key, value);
    } catch (error) {
      console.error(
        "Failed to persist FHE decryption signature to storage:",
        error
      );
    }
  }

  static async loadFromStorage(
    storage: GenericStringStorage,
    instance: FhevmInstance,
    contractAddresses: string[],
    userAddress: string,
    publicKey?: string
  ): Promise<FhevmDecryptionSignature | null> {
    try {
      const storageKey = new FhevmDecryptionSignatureStorageKey(
        instance,
        contractAddresses,
        userAddress,
        publicKey
      );
      const raw = await storage.getItem(storageKey.key);

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      const candidate = new FhevmDecryptionSignature({
        publicKey: parsed.publicKey,
        privateKey: parsed.privateKey,
        signature: parsed.signature,
        startTimestamp: parsed.startTimestamp,
        durationDays: parsed.durationDays,
        userAddress: parsed.userAddress,
        contractAddresses: parsed.contractAddresses,
        eip712: parsed.eip712,
      });

      if (!candidate.isValid()) {
        return null;
      }

      return candidate;
    } catch (error) {
      console.error(
        "Failed to load FHE decryption signature from storage:",
        error
      );
      return null;
    }
  }

  static async create(
    instance: FhevmInstance,
    contractAddresses: string[],
    publicKey: string,
    privateKey: string,
    signer: ethers.Signer
  ): Promise<FhevmDecryptionSignature | null> {
    try {
      const userAddress = (await signer.getAddress()) as `0x${string}`;
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 365;
      const eip712 = instance.createEIP712(
        publicKey,
        contractAddresses,
        startTimestamp,
        durationDays
      );
      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification:
            eip712.types.UserDecryptRequestVerification,
        },
        eip712.message
      );

      return new FhevmDecryptionSignature({
        publicKey,
        privateKey,
        signature,
        startTimestamp,
        durationDays,
        userAddress,
        contractAddresses: contractAddresses as `0x${string}`[],
        eip712,
      });
    } catch (error) {
      console.error("Failed to create new FHEVM decryption signature:", error);
      return null;
    }
  }

  static async loadOrSign(
    instance: FhevmInstance,
    contractAddresses: string[],
    signer: ethers.Signer,
    storage: GenericStringStorage,
    keyPair?: { publicKey: string; privateKey: string }
  ): Promise<FhevmDecryptionSignature | null> {
    const normalizedContracts = (
      contractAddresses as `0x${string}`[]
    ).map((address) => ethers.getAddress(address));

    const userAddress = (await signer.getAddress()) as `0x${string}`;

    const cached = await FhevmDecryptionSignature.loadFromStorage(
      storage,
      instance,
      normalizedContracts,
      userAddress,
      keyPair?.publicKey
    );

    if (cached) {
      return cached;
    }

    const { publicKey, privateKey } =
      keyPair ?? instance.generateKeypair();

    const signature = await FhevmDecryptionSignature.create(
      instance,
      normalizedContracts,
      publicKey,
      privateKey,
      signer
    );

    if (!signature) {
      return null;
    }

    await signature.saveToStorage(
      storage,
      instance,
      Boolean(keyPair?.publicKey)
    );

    return signature;
  }
}
