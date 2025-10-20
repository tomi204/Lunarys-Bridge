// programs/contracts/src/instructions/release_sol.rs
use crate::errors::ErrorCode;
use crate::events::IncomingBridgeDelivered;
use crate::state::BridgeConfig;
use crate::{SignerAccount, ID_CONST};

use anchor_lang::prelude::*;
use anchor_spl::token::{
    self as token,
    spl_token, // para native_mint::id()
    CloseAccount,
    Token,
    TokenAccount,
    Transfer,
};
use arcium_anchor::prelude::*;

/// Releases WSOL from the escrow (owner = signing PDA) to a recipient's WSOL account.
/// Optionally closes the escrow if it remains at zero (to recover rent).
#[derive(Accounts)]
pub struct ReleaseSol<'info> {
    /// Authorized relayer (must be the owner in the config)
    #[account(mut, address = config.owner)]
    pub relayer: Signer<'info>,

    /// Global config (only to authorize the relayer)
    #[account(seeds=[b"config"], bump = config.bump)]
    pub config: Account<'info, BridgeConfig>,

    /// WSOL escrow (mint = NATIVE_MINT) owned by the signing PDA
    #[account(
        mut,
        constraint = escrow_wsol.mint == spl_token::native_mint::id() @ ErrorCode::InvalidMint,
        constraint = escrow_wsol.owner == derive_sign_pda!() @ ErrorCode::InvalidOwner
    )]
    pub escrow_wsol: Account<'info, TokenAccount>,

    /// Recipient's WSOL account (can be their ATA or any WSOL TokenAccount)
    #[account(
        mut,
        constraint = recipient_wsol.mint == spl_token::native_mint::id() @ ErrorCode::InvalidMint,
        constraint = recipient_wsol.owner == recipient.key() @ ErrorCode::InvalidOwner
    )]
    pub recipient_wsol: Account<'info, TokenAccount>,

    /// Recipient's public wallet (owner of `recipient_wsol`)
    /// CHECK: only used for the constraint above and for the event
    pub recipient: UncheckedAccount<'info>,

    /// Account that receives the rent if the escrow is closed
    /// CHECK: only receives lamports in CloseAccount
    #[account(mut)]
    pub escrow_refund_destination: UncheckedAccount<'info>,

    /// Signing PDA used by Arcium (contains the bump)
    #[account(
        mut,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ReleaseSol>, amount: u64) -> Result<()> {
    // 0) Defensive check: that the escrow balance is sufficient
    require!(
        ctx.accounts.escrow_wsol.amount >= amount,
        ErrorCode::InsufficientEscrowBalance
    );

    // 1) Transfer WSOL escrow -> recipient_wsol (signed by the PDA)
    let bump = ctx.bumps.sign_pda_account;
    let signer_seeds: &[&[u8]] = &[&SIGN_PDA_SEED, &[bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_wsol.to_account_info(),
                to: ctx.accounts.recipient_wsol.to_account_info(),
                authority: ctx.accounts.sign_pda_account.to_account_info(),
            },
            &[signer_seeds],
        ),
        amount,
    )?;

    // 2) (Optional) If it remained at 0, close the escrow to recover rent
    if ctx.accounts.escrow_wsol.amount == 0 {
        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.escrow_wsol.to_account_info(),
                destination: ctx.accounts.escrow_refund_destination.to_account_info(),
                authority: ctx.accounts.sign_pda_account.to_account_info(),
            },
            &[signer_seeds],
        ))?;
    }

    // 3) Symmetric event to the EVM
    emit!(IncomingBridgeDelivered {
        recipient: ctx.accounts.recipient.key(),
        token: spl_token::native_mint::id(),
        amount,
    });

    Ok(())
}
