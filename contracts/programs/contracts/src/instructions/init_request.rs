use anchor_lang::prelude::*;
use core::mem::size_of;

use crate::state::BridgeRequest;

#[derive(Accounts)]
#[instruction(request_id: u64)]
pub struct InitRequest<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + size_of::<BridgeRequest>(),
        seeds = [b"request", payer.key().as_ref(), &request_id.to_le_bytes()],
        bump
    )]
    pub request_pda: Account<'info, BridgeRequest>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitRequest>,
    _request_id: u64,
    token_mint: Pubkey,
    amount_locked: u64,
    fee_locked: u64,
    solver: Option<Pubkey>,
    claim_deadline: Option<i64>,
) -> Result<()> {
    let request = &mut ctx.accounts.request_pda;

    request.payer = ctx.accounts.payer.key();
    request.token_mint = token_mint;
    request.amount_locked = amount_locked;
    request.fee_locked = fee_locked;
    request.created_at = Clock::get()?.unix_timestamp;
    request.claimed = solver.is_some();
    request.solver = solver.unwrap_or(Pubkey::default());
    request.claim_deadline = claim_deadline.unwrap_or(0);
    request.bond_lamports = 0;
    request.finalized = false;
    request.bump = ctx.bumps.request_pda;

    Ok(())
}
