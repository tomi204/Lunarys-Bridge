use crate::errors::ErrorCode;
use crate::events::BridgeClaimExpired;
use crate::state::{BridgeConfig, BridgeRequest};

use anchor_lang::prelude::*;

/// Must match the seed used in `claim_request.rs`
pub const BOND_VAULT_SEED: &[u8] = b"bond";

#[derive(Accounts)]
#[instruction(request_id: u64)]
pub struct ReleaseExpiredClaim<'info> {
    /// Anyone can call this; we don't charge rent or create accounts here.
    pub caller: Signer<'info>,

    /// Global config (contains slash_bps, owner as slash collector, etc.)
    #[account(seeds=[b"config"], bump = config.bump)]
    pub config: Account<'info, BridgeConfig>,

    /// BridgeRequest PDA (Variant B: seeds include external `request_owner`)
    #[account(
        mut,
        seeds = [b"request", request_owner.key().as_ref(), &request_id.to_le_bytes()],
        bump = request_pda.bump
    )]
    pub request_pda: Account<'info, BridgeRequest>,

    /// Only used for seeds; in Variant A you wouldn't pass this.
    /// CHECK: seeds-only
    pub request_owner: UncheckedAccount<'info>,

    /// PDA that currently holds the solver's bond in lamports.
    #[account(
        mut,
        seeds = [BOND_VAULT_SEED, &request_id.to_le_bytes()],
        bump
    )]
    pub bond_vault: SystemAccount<'info>,

    /// We transfer the refund back to the *previous* solver.
    /// We verify at runtime it matches `request_pda.solver`.
    /// CHECK: validated at runtime with `require_keys_eq!`
    #[account(mut)]
    pub prev_solver: UncheckedAccount<'info>,

    /// We send the slash part to the slash collector (use config.owner for simplicity).
    /// CHECK: address checked against config.owner
    #[account(mut, address = config.owner)]
    pub slash_collector: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<ReleaseExpiredClaim>, _request_id: u64) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let req = &mut ctx.accounts.request_pda;

    // --- Guards (mirror Solidity behavior) ---
    // The request must be currently claimed.
    require!(req.claimed, ErrorCode::NoClaim);
    // Must be expired to release.
    let now = Clock::get()?.unix_timestamp;
    require!(now > req.claim_deadline, ErrorCode::ActiveClaim); // "ActiveClaim" = not expired

    // prev_solver must match the one recorded in the request.
    require_keys_eq!(
        ctx.accounts.prev_solver.key(),
        req.solver,
        ErrorCode::InvalidOwner
    );

    // --- Compute slash and refund ---
    let bond = req.bond_lamports as u128;
    let slash = bond
        .checked_mul(cfg.slash_bps as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10_000)
        .ok_or(ErrorCode::MathOverflow)?;
    let refund = bond.checked_sub(slash).ok_or(ErrorCode::MathOverflow)?;

    let slash_u64 = u64::try_from(slash).map_err(|_| ErrorCode::MathOverflow)?;
    let refund_u64 = u64::try_from(refund).map_err(|_| ErrorCode::MathOverflow)?;

    // Sanity: make sure the vault has at least the bond.
    let vault_info = ctx.accounts.bond_vault.to_account_info();
    let vault_lamports = **vault_info.lamports.borrow();
    require!(vault_lamports >= req.bond_lamports, ErrorCode::MathOverflow);

    // --- Move lamports directly (program-owned PDA → system accounts) ---
    // Subtract from vault
    **ctx
        .accounts
        .bond_vault
        .to_account_info()
        .try_borrow_mut_lamports()? -= req.bond_lamports;

    // Add to collector (slash)
    if slash_u64 > 0 {
        **ctx
            .accounts
            .slash_collector
            .to_account_info()
            .try_borrow_mut_lamports()? += slash_u64;
    }

    // Add to solver (refund)
    if refund_u64 > 0 {
        **ctx
            .accounts
            .prev_solver
            .to_account_info()
            .try_borrow_mut_lamports()? += refund_u64;
    }

    // --- Clean request state (free to be claimed again) ---
    req.claimed = false;
    req.solver = Pubkey::default();
    req.claim_deadline = 0;
    req.bond_lamports = 0;

    emit!(BridgeClaimExpired {
        request_id: _request_id,
        solver: ctx.accounts.prev_solver.key(),
        slashed: slash_u64,
    });

    msg!(
        "expired claim released: slash={}, refund={}",
        slash_u64,
        refund_u64
    );
    Ok(())
}
