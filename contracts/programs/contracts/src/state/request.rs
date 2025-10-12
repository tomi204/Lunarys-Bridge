use anchor_lang::prelude::*;

#[account]
pub struct BridgeRequest {
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
}
