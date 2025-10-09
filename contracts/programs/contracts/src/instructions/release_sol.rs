use crate::{SignerAccount, ID_CONST};
use anchor_lang::prelude::*;
use anchor_spl::token::{self as token, CloseAccount, Token, TokenAccount, Transfer};
use arcium_anchor::prelude::*;

/// Releases WSOL from the PDA-owned escrow to a recipient's WSOL account.
/// Optionally closes the escrow if its balance reaches zero to refund rent.
#[derive(Accounts)]
pub struct ReleaseSol<'info> {
    /// Payer for possible tiny rent adjustments / tx fees (mutable just in case)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// WSOL escrow owned by the signing PDA (mint = NATIVE_MINT)
    #[account(
        mut,
        constraint = escrow_wsol.mint == anchor_spl::token::spl_token::native_mint::id() @ ErrorCode::InvalidMint,
        constraint = escrow_wsol.owner == derive_sign_pda!() @ ErrorCode::InvalidOwner
    )]
    pub escrow_wsol: Account<'info, TokenAccount>,

    /// Recipient WSOL token account (can be recipient's ATA or any WSOL account)
    #[account(
        mut,
        constraint = recipient_wsol.mint == anchor_spl::token::spl_token::native_mint::id() @ ErrorCode::InvalidMint


    )]
    pub recipient_wsol: Account<'info, TokenAccount>,

    /// Account that will receive the rent when closing the escrow (if closed)
    /// Usually a plain System account controlled by your ops or the payer
    /// CHECK: only receives lamports on close; no additional assumptions
    #[account(mut)]
    pub escrow_refund_destination: UncheckedAccount<'info>,

    /// Signing PDA account used by Arcium; holds the bump we must use as signer
    #[account(
        mut,
        seeds = [&SIGN_PDA_SEED],
        bump = sign_pda_account.bump,
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,

    /// SPL Token Program
    pub token_program: Program<'info, Token>,

    /// System Program (kept for completeness; not used by token CPIs)
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid token mint")]
    InvalidMint,
    #[msg("Invalid token owner")]
    InvalidOwner,
}

/// Release a specific amount of WSOL from the escrow to `recipient_wsol`.
/// If the escrow ends with zero WSOL, it will be closed and rent refunded.
pub fn handler(ctx: Context<ReleaseSol>, amount: u64) -> Result<()> {
    // --- 1) Transfer WSOL from escrow -> recipient_wsol ---
    // Authority is the PDA (signer) — we must sign with seeds.
    let signer_seeds: &[&[&[u8]]] = &[&[&SIGN_PDA_SEED[..], &[ctx.accounts.sign_pda_account.bump]]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_wsol.to_account_info(),
                to: ctx.accounts.recipient_wsol.to_account_info(),
                authority: ctx.accounts.sign_pda_account.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // --- 2) If escrow is empty, close it to refund rent lamports ---
    // Re-load to get the updated amount after transfer.
    let escrow_after = &ctx.accounts.escrow_wsol;

    if escrow_after.amount == 0 {
        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.escrow_wsol.to_account_info(),
                destination: ctx.accounts.escrow_refund_destination.to_account_info(),
                authority: ctx.accounts.sign_pda_account.to_account_info(),
            },
            signer_seeds,
        ))?;
    }

    Ok(())
}
