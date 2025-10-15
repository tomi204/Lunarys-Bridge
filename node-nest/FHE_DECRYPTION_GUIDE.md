# FHE Decryption Guide for Bridge Node

## Overview

The bridge node uses Fully Homomorphic Encryption (FHE) via Zama's FHEVM to decrypt the Solana destination address that was encrypted on the frontend before being stored in the `NewRelayer` smart contract.

## How It Works

### 1. Encryption (Frontend)

When a user initiates a bridge transaction in the frontend:

1. The user enters a Solana destination address (base58 format)
2. The address is decoded from base58 to bytes (32 bytes)
3. The bytes are converted to a `uint256` (bigint)
4. The value is encrypted using FHE with `fhevm.createEncryptedInput()`
5. The encrypted value (`euint256`) is sent to the `NewRelayer` contract

**Code reference:** `frontend/providers/fhevm-bridge-provider.tsx`

```typescript
// Decode Solana address (base58) to bytes
const decoded = bs58.decode(destination);
// Convert bytes to bigint
const value = BigInt("0x" + Buffer.from(decoded).toString("hex"));
// Encrypt with FHE
const encryptedInput = fhevm.createEncryptedInput(contractAddress, userAddress);
encryptedInput.add256(value);
const encrypted = await encryptedInput.encrypt();
```

### 2. Storage (Smart Contract)

The `NewRelayer` contract stores the encrypted destination:

```solidity
struct BridgeRequest {
    address sender;
    address token;
    uint256 amount;
    euint256 encryptedSolanaDestination; // FHE encrypted!
    uint256 timestamp;
    bool finalized;
    uint256 fee;
}
```

When the bridge is initiated, permissions are granted:

- To the sender (for transparency)
- To the contract itself
- To the relayer (for verification)

When a solver (node) claims the request, the contract grants FHE permission:

```solidity
FHE.allow(req.encryptedSolanaDestination, msg.sender);
```

**Code reference:** `evm-contracts/contracts/NewRelayer.sol` lines 256-258, 319

### 3. Decryption (Node)

When the bridge node processes a request:

1. **Initialize FHE instance:**

   ```typescript
   this.fhevmInstance = await createInstance({
     chainId: this.config.fhevmChainId,
     networkUrl: this.config.ethereumRpcUrl,
     gatewayUrl: this.config.fhevmGatewayUrl,
   });
   ```

2. **Generate keypair for decryption:**

   ```typescript
   this.keypair = this.fhevmInstance.generateKeypair();
   ```

3. **Fetch encrypted handle from contract:**

   ```typescript
   const bridgeRequest = await newRelayer.bridgeRequests(requestId);
   const encryptedHandle = bridgeRequest.encryptedSolanaDestination;
   ```

4. **Create EIP-712 signature:**

   ```typescript
   const eip712 = this.fhevmInstance.createEIP712(
     this.keypair.publicKey,
     [newRelayerAddress],
     startTimestamp,
     durationDays
   );
   const signature = await this.wallet.signTypedData(
     eip712.domain,
     {
       UserDecryptRequestVerification:
         eip712.types.UserDecryptRequestVerification,
     },
     eip712.message
   );
   ```

5. **Request decryption from Zama Gateway:**

   ```typescript
   const decryptionResults = await this.fhevmInstance.reencrypt(
     handleToDecrypt,
     this.keypair.privateKey,
     this.keypair.publicKey,
     signature,
     newRelayerAddress,
     userAddress
   );
   ```

6. **Convert decrypted value to Solana address:**
   ```typescript
   // decryptionResults is a uint256 (bigint)
   const addressBytes = bigIntToBytes32(decryptionResults);
   const solanaAddress = bs58.encode(addressBytes);
   ```

**Code reference:** `node/src/utils/fheDecryption.ts`

## Key Differences from Frontend Implementation

The node implementation differs from `fhevm-react` in a few ways:

1. **Uses `fhevmjs/node`** instead of the browser SDK
2. **Uses `reencrypt()`** instead of `decrypt()` - this is the correct method for accessing encrypted values with proper permissions
3. **Must generate its own keypair** for the decryption process
4. **Requires EIP-712 signature** to prove authorization

## Security Considerations

1. **Permissions:** The node can only decrypt values after claiming the bridge request (when `FHE.allow()` is called in the contract)
2. **Gateway verification:** Zama's gateway verifies the signature before decrypting
3. **Time-limited signatures:** EIP-712 signatures have a start time and duration (default: 1 day)
4. **Private keys:** The node's keypair is ephemeral and generated on initialization

## Configuration

Required environment variables in `node/.env`:

```bash
# Ethereum/FHEVM Configuration
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
ETHEREUM_PRIVATE_KEY=0x...
NEW_RELAYER_ADDRESS=0x...

# FHEVM Configuration
FHEVM_CHAIN_ID=11155111  # Sepolia
FHEVM_GATEWAY_URL=https://gateway.sepolia.zama.ai

# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=[...]  # JSON array or base58
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BRIDGE FLOW                                │
└─────────────────────────────────────────────────────────────────────┘

Frontend                     Contract                    Bridge Node
────────                     ────────                    ───────────

1. User enters Solana addr
   │
2. Encode to uint256
   │
3. Encrypt with FHE ──────────────────►
                                        │
                                4. Store euint256
                                   in BridgeRequest
                                        │
                                        ◄──────────── 5. Detect event
                                                         │
                                                     6. Claim request
                                                         (post bond)
                                        │
                                7. Grant FHE permissions
                                   FHE.allow(handle, solver)
                                        │
                                        ◄──────────── 8. Decrypt with
                                                         Zama Gateway
                                                         │
                                                     9. Convert to base58
                                                         │
                                                     10. Transfer SOL/SPL
                                                         to decrypted addr
                                                         │
                                                     11. Submit verification
                                                         │
                                        ◄──────────── 12. Relayer calls
                                                         verifyAndSettle()
                                        │
                                13. Pay solver + refund bond
                                        │
                                14. Bridge complete! ✓
```

## Troubleshooting

### "FHE instance not initialized"

- Check that `FHEVM_GATEWAY_URL` is correct
- Verify network connectivity to the gateway
- Ensure `FHEVM_CHAIN_ID` matches your Ethereum network

### "Decryption failed: No results returned"

- Verify the node is authorized (`authorizeNode()` was called)
- Check that the claim was successful (bond was posted)
- Ensure FHE permissions were granted in the contract

### "Invalid handle"

- The handle structure from Solidity may be a tuple - code handles this automatically
- Check contract ABI matches the actual contract structure

### Decimal Conversion Issues

- **Important:** The `amount` from Ethereum is in ERC20 units (e.g., USDC = 6 decimals)
- Solana SOL uses 9 decimals (lamports)
- SPL tokens can have varying decimals
- You may need to implement conversion logic based on token mappings

## Next Steps

1. **Token Mapping:** Implement a mapping from ERC20 addresses to SPL token mints
2. **Decimal Conversion:** Add proper decimal conversion between chains
3. **Error Handling:** Add retry logic for gateway timeouts
4. **Monitoring:** Log all decryption attempts for debugging
5. **Testing:** Test with various Solana addresses and amounts

## References

- **Zama FHEVM Docs:** https://docs.zama.ai/fhevm
- **fhevmjs GitHub:** https://github.com/zama-ai/fhevmjs
- **NewRelayer Contract:** `evm-contracts/contracts/NewRelayer.sol`
- **Frontend Encryption:** `frontend/providers/fhevm-bridge-provider.tsx`
- **Node Decryption:** `node/src/utils/fheDecryption.ts`
