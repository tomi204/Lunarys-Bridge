use crate::events::IncomingBridgeDelivered;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self as token, Mint, Token, TokenAccount, TransferChecked};
use arcium_anchor::prelude::*;

use crate::errors::ErrorCode;
use crate::state::BridgeConfig;
use crate::{SignerAccount, ID_CONST};

#[derive(Accounts)]
pub struct ReleaseSpl<'info> {
    /// Relayer (authorized) and payer of rent/ATAs
    #[account(mut, address = config.owner)] // <-- ONLY RELAYER
    pub relayer: Signer<'info>, // <-- RENAMED (was "payer")

    /// Token mint (USDC/USDT)
    pub mint: Account<'info, Mint>,

    /// Escrow that holds the locked tokens (owner = signing PDA)
    #[account(
        mut,
        constraint = escrow_token.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = escrow_token.owner == derive_sign_pda!() @ ErrorCode::InvalidOwner,
    )]
    pub escrow_token: Account<'info, TokenAccount>,

    /// Recipient's ATA (created if it doesn't exist)
    #[account(
        init_if_needed,
        payer = relayer,                                     // <-- RELAYER PAYS
        associated_token::mint = mint,
        associated_token::authority = recipient,
    )]
    pub recipient_token: Account<'info, TokenAccount>,

    /// Public recipient
    /// CHECK: only ATA authority
    pub recipient: UncheckedAccount<'info>,

    /// Global config (used to authorize the relayer)
    #[account(seeds=[b"config"], bump = config.bump)] // <-- NEW
    pub config: Account<'info, BridgeConfig>, // <-- NEW

    // Programs
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    // Arcium signing PDA
    #[account(
        mut,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
}

pub fn handler(ctx: Context<ReleaseSpl>, amount: u64) -> Result<()> {
    // Defensive check of escrow funds (optional)
    require!(
        ctx.accounts.escrow_token.amount >= amount,
        ErrorCode::InsufficientEscrowBalance
    );

    // PDA signature
    let bump = ctx.bumps.sign_pda_account;
    let signer_seeds: &[&[u8]] = &[&SIGN_PDA_SEED, &[bump]];

    // SPL Transfer
    token::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.escrow_token.to_account_info(),
                to: ctx.accounts.recipient_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.sign_pda_account.to_account_info(),
            },
            &[signer_seeds],
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    // EVM mirror event
    emit!(IncomingBridgeDelivered {
        recipient: ctx.accounts.recipient.key(),
        token: ctx.accounts.mint.key(),
        amount,
    });

    Ok(())
}
