use anchor_lang::prelude::*;

#[account]
pub struct BridgeRequest {
    // --- basic / state ---
    pub request_id: u64,
    pub payer: Pubkey,
    pub token_mint: Pubkey,
    pub amount_locked: u64,
    pub fee_locked: u64,
    pub created_at: i64,
    pub claimed: bool,
    pub solver: Pubkey,
    pub claim_deadline: i64,
    pub bond_lamports: u64,
    pub finalized: bool,
    pub bump: u8,

    // --- material for reseal (new) ---
    pub client_pubkey: [u8; 32], // client's ephemeral x25519
    pub nonce_le: u128,          // 16-byte nonce in LE
    pub dest_ct_w0: [u8; 32],    // 4 encrypted u64 words (destination)
    pub dest_ct_w1: [u8; 32],
    pub dest_ct_w2: [u8; 32],
    pub dest_ct_w3: [u8; 32],
}
