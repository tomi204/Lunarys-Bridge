use anchor_lang::prelude::*;

#[account]
pub struct BridgeConfig {
    pub owner: Pubkey,
    pub fee_bps: u16,           // 0..=1000 (10%)
    pub min_fee: u64,           // in token units
    pub max_fee: u64,           // in token units
    pub claim_window_secs: i64, // p.ej. 600 (10 min)
    pub min_solver_bond: u64,   // lamports
    pub slash_bps: u16,         // 0..=10000
    pub bump: u8,
}
