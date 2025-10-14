use crate::state::BridgeConfig;
use anchor_lang::prelude::*;
use core::mem::size_of;

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + size_of::<BridgeConfig>(),
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, BridgeConfig>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitConfig>,
    fee_bps: u16,
    min_fee: u64,
    max_fee: u64,
    claim_window_secs: i64,
    min_solver_bond: u64,
    slash_bps: u16,
) -> Result<()> {
    let bump = ctx.bumps.config;
    let cfg = &mut ctx.accounts.config;
    cfg.owner = ctx.accounts.payer.key();
    cfg.fee_bps = fee_bps;
    cfg.min_fee = min_fee;
    cfg.max_fee = max_fee;
    cfg.claim_window_secs = claim_window_secs;
    cfg.min_solver_bond = min_solver_bond;
    cfg.slash_bps = slash_bps;
    cfg.bump = bump;
    Ok(())
}
