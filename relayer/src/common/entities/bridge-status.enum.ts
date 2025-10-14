export enum BridgeStatus {
  RECEIVED = 'RECEIVED',  // request stored on API hit
  VERIFIED = 'VERIFIED',  // destination-chain evidence verified
  SETTLED  = 'SETTLED',   // on-chain payout/release executed (if applicable)
  FAILED   = 'FAILED',
}