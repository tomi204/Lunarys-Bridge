use anchor_lang::prelude::*;

#[event]
pub struct BridgeInitiated {
    pub request_id: u64,
    pub sender: Pubkey,
    pub token: Pubkey,         // SPL mint (or WSOL for SOL)
    pub amount_after_fee: u64, // net amount
    pub fee: u64,              // locked fee
    pub ts: u64,               // timestamp
}

#[event]
pub struct AttestationQueued {
    pub nonce: [u8; 16],
}

#[event]
pub struct BridgePaidToSolver {
    pub request_id: u64,
    pub solver: Pubkey,
    pub token_mint: Pubkey,
    pub payout: u64, // amount_locked + fee_locked
}

#[event]
pub struct BridgeClaimExpired {
    pub request_id: u64,
    pub solver: Pubkey,
    pub slashed: u64, // slashed lamports
}

#[event]
pub struct SolverBondRefunded {
    pub request_id: u64,
    pub solver: Pubkey,
    pub refunded_bond: u64,
}

#[event]
pub struct BridgeVerifiedUrl {
    pub request_id: u64,
    pub relayer: Pubkey,
    pub dest_tx_hash: [u8; 32],
    pub evidence_hash: [u8; 32],
    pub evidence_url: String,
}

#[event]
pub struct IncomingBridgeDelivered {
    pub recipient: Pubkey,
    pub token: Pubkey, // SPL mint; for SOL use WSOL mint
    pub amount: u64,
}

#[event]
pub struct BridgeClaimed {
    pub request_id: u64,
    pub solver: Pubkey,
    pub bond: u64,     // lamports locked as bond
    pub deadline: i64, // unix ts until the claim expires
}
