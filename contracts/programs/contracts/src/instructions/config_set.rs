use crate::errors::ErrorCode;
use crate::state::BridgeConfig;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SetConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        constraint = config.owner == authority.key() @ ErrorCode::OnlyOwner
    )]
    pub config: Account<'info, BridgeConfig>,
}

pub fn handler(
    ctx: Context<SetConfig>,
    fee_bps: Option<u16>,
    min_fee: Option<u64>,
    max_fee: Option<u64>,
    claim_window_secs: Option<i64>,
    min_solver_bond: Option<u64>,
    slash_bps: Option<u16>,
) -> Result<()> {
    let cfg = &mut ctx.accounts.config;

    if let Some(v) = fee_bps {
        cfg.fee_bps = v;
    }
    if let Some(v) = min_fee {
        cfg.min_fee = v;
    }
    if let Some(v) = max_fee {
        cfg.max_fee = v;
    }
    if let Some(v) = claim_window_secs {
        cfg.claim_window_secs = v;
    }
    if let Some(v) = min_solver_bond {
        cfg.min_solver_bond = v;
    }
    if let Some(v) = slash_bps {
        cfg.slash_bps = v;
    }

    Ok(())
}
