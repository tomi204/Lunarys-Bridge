# Bridge Node

A competitive solver node for the EVM to Solana cross-chain bridge. This node monitors bridge requests, claims them with bonds, decrypts FHE-encrypted Solana addresses, and executes transfers.

## Features

- **Ethereum Event Monitoring**: Listens for `BridgeInitiated` events from the NewRelayer contract
- **Competitive Claiming**: Claims bridge requests with ETH bonds (minimum 0.02 ETH)
- **FHE Decryption**: Decrypts encrypted Solana destination addresses using fhEVM
- **Solana Transfers**: Executes SOL and SPL token transfers on Solana
- **Relayer API Integration**: Submits verification proofs to the relayer backend

## Architecture

```
┌─────────────────┐
│  Ethereum Net   │
│   NewRelayer    │◄──── Monitor Events
└────────┬────────┘
         │
         ▼
    ┌────────────┐
    │ Bridge Node│
    └─────┬──────┘
          │
          ├──► Claim Request (with bond)
          ├──► Decrypt FHE Address
          ├──► Transfer on Solana
          └──► Submit Verification
```

## Prerequisites

- Node.js 20+
- Ethereum wallet with:
  - ETH for gas and bonds (minimum 0.03 ETH recommended)
  - Must be authorized in the NewRelayer contract's node whitelist
- Solana wallet with:
  - SOL for transaction fees
  - Tokens to transfer (if bridging SPL tokens)

## Installation

```bash
cd node
npm install
```

## Configuration

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Edit `.env` with your configuration:

```env
# Ethereum Configuration
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
ETHEREUM_PRIVATE_KEY=your_ethereum_private_key_here
NEW_RELAYER_ADDRESS=0x0fC588e5EF7cEA7d728a979B6053e49A371587B2

# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=your_solana_private_key_base58_here

# Node Settings
BOND_AMOUNT=0.03
POLL_INTERVAL=12000

# FHE Configuration
FHEVM_CHAIN_ID=11155111
FHEVM_GATEWAY_URL=https://gateway.sepolia.zama.ai
```

### Getting Your Node Authorized

Before running the node, your Ethereum address must be authorized by the NewRelayer contract owner:

```bash
# On the main project directory
npx hardhat console --network sepolia

# In the console:
const NewRelayer = await ethers.getContractAt("NewRelayer", "0x0fC588e5EF7cEA7d728a979B6053e49A371587B2");
await NewRelayer.authorizeNode("YOUR_NODE_ETH_ADDRESS");
```

## Usage

### Build

```bash
npm run build
```

### Run in Development Mode

```bash
npm run dev
```

### Run in Production

```bash
npm run build
npm start
```

## How It Works

### 1. Monitoring Phase

The node continuously monitors the NewRelayer contract for `BridgeInitiated` events:

```typescript
event BridgeInitiated(
    uint256 indexed requestId,
    address indexed sender,
    address token,
    uint256 amount,
    bytes32 encryptedSolanaDestination
)
```

### 2. Claiming Phase

When a new bridge request is detected:

- Node checks if it's already claimed
- Calls `claimBridge(requestId)` with the required bond (0.03 ETH)
- Bond is locked for 10 minutes while the transfer is executed

### 3. Decryption Phase

The node decrypts the Solana destination address using Zama's FHEVM:

- Initializes fhevmjs instance with gateway connection
- Generates ephemeral keypair for decryption
- Fetches the encrypted handle from the `bridgeRequests` mapping
- Signs EIP-712 message for authorization
- Calls `reencrypt()` to decrypt the Solana address via Zama Gateway
- Converts the decrypted uint256 to a base58 Solana address

**Note**: The node must have FHE permissions granted by the contract (via `claimBridge()`). See `FHE_DECRYPTION_GUIDE.md` for detailed implementation.

### 4. Transfer Phase

Transfers tokens on Solana:

- For SOL: Direct `SystemProgram.transfer()`
- For SPL tokens: Uses `@solana/spl-token` library
- Creates or uses existing associated token accounts

### 5. Verification Phase

Submits proof to the relayer API:

```json
{
  "requestId": "123",
  "ethClaimTxHash": "0x...",
  "solanaTransferSignature": "5K...",
  "solanaDestination": "7Eq...",
  "amount": "1000000",
  "token": "0x..."
}
```

The relayer backend verifies the Solana transaction and calls `verifyBridge()` on the contract.

## Project Structure

```
node/
├── src/
│   ├── config/
│   │   └── config.ts              # Configuration loader
│   ├── services/
│   │   ├── ethereumMonitor.ts     # Ethereum event monitoring
│   │   ├── solanaTransfer.ts      # Solana transfer service
│   │   └── relayerApi.ts          # Relayer API client
│   ├── utils/
│   │   └── fheDecryption.ts       # FHE decryption utilities
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   └── index.ts                   # Main entry point
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Error Handling

The node handles various error scenarios:

- **Already Claimed**: Skips if another node claimed first
- **Insufficient Bond**: Requires minimum 0.02 ETH
- **Not Authorized**: Node must be whitelisted
- **FHE Decryption Failed**: Logs error and skips request
- **Solana Transfer Failed**: Reports error, bond may be slashed
- **API Verification Failed**: Logs warning, continues operation

## Security Considerations

### Bond Management

- Minimum bond: 0.02 ETH
- Bond locked for 10 minutes during transfer
- 50% slashed if transfer not verified
- Returned after successful verification

### Private Key Safety

- Never commit `.env` file
- Use environment variables in production
- Consider using key management services (AWS KMS, etc.)

### Network Security

- Use HTTPS for all RPC connections
- Verify SSL certificates
- Monitor for suspicious activity

## Monitoring & Logs

The node outputs detailed logs for all operations:

```
========================================
   Bridge Node Started
========================================
Listening for bridge requests...

=================================
New Bridge Request Detected!
=================================
Request ID: 1
Sender: 0x123...
Token: 0xabc...
Amount: 1.5 tokens
=================================

>>> Processing bridge request 1...

[1/4] Claiming bridge request on Ethereum...
✓ Bridge request 1 claimed successfully!

[2/4] Decrypting Solana destination address...
Decrypted destination: 7EqQd...

[3/4] Transferring tokens on Solana...
✓ SOL transfer successful!

[4/4] Submitting verification to relayer API...
✓ Verification submitted successfully!

✓✓✓ Bridge request 1 processed successfully! ✓✓✓
```

## Troubleshooting

### "Node address is not authorized"

- Contact the NewRelayer contract owner to authorize your node
- Check that you're using the correct Ethereum address

### "FHE decryption failed"

- Ensure `FHEVM_GATEWAY_URL` is correct and accessible
- Verify the node has been granted FHE permissions (after claiming)
- Check that `FHEVM_CHAIN_ID` matches your network
- See `FHE_DECRYPTION_GUIDE.md` for troubleshooting

### "Relayer API is not responding"

- Check `RELAYER_API_URL` in `.env`
- Ensure the relayer backend is running
- The node will continue without API verification

### "Insufficient funds for bond"

- Ensure your Ethereum wallet has at least 0.03 ETH
- Check gas prices and adjust bond amount if needed

## Future Enhancements

- [x] Complete FHE decryption implementation ✓
- [ ] SPL token mapping (ERC20 → SPL mint addresses)
- [ ] Decimal conversion between ERC20 and SPL tokens
- [ ] Automatic bond replenishment
- [ ] Multi-request batching
- [ ] Performance metrics and monitoring
- [ ] Automatic retry logic with exponential backoff
- [ ] Database for request tracking and analytics
- [ ] Support for multiple concurrent claims

## License

BSD-3-Clause

## Support

For issues and questions, please refer to the main project documentation.
