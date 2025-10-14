use anchor_lang::prelude::*;

#[event]
pub struct BridgeDeposit {
    pub deposit_id: [u8; 32], // key of the comp_account or the hash of the deposit
    pub amount_commitment: [u8; 32], // optional: [0; 32]
    pub recipient_hash: [u8; 32], // optional: [0; 32]
    pub nonce: u128,          // correlation nonce
    pub ts: u64,              // timestamp on-chain
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
    pub slashed: u64, // lamports slashed
}
