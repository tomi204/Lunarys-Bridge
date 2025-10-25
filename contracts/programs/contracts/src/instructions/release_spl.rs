use crate::errors::ErrorCode;
use crate::events::IncomingBridgeDelivered;
use crate::state::BridgeConfig;
use crate::{SignerAccount, ID_CONST}; // ⬅️ los macros de Arcium usan ID/ID_CONST

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self as token, Mint, Token, TokenAccount, TransferChecked};
use arcium_anchor::prelude::*;

#[derive(Accounts)]
pub struct ReleaseSpl<'info> {
    /// Relayer autorizado (dueño del config)
    #[account(mut, address = config.owner)]
    pub relayer: Signer<'info>,

    /// Mint del token (mediano) -> mover a heap
    pub mint: Box<Account<'info, Mint>>,

    /// Escrow que contiene los tokens (owner = PDA signer)
    #[account(
        mut,
        constraint = escrow_token.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = escrow_token.owner == derive_sign_pda!() @ ErrorCode::InvalidOwner,
    )]
    pub escrow_token: Box<Account<'info, TokenAccount>>,

    /// ATA del receptor (se crea si no existe)
    #[account(
        init_if_needed,
        payer = relayer,
        associated_token::mint = mint,
        associated_token::authority = recipient,
    )]
    pub recipient_token: Box<Account<'info, TokenAccount>>,

    /// Receptor público (solo autoridad de la ATA)
    /// CHECK: solo se usa como owner de la ATA
    pub recipient: UncheckedAccount<'info>,

    /// Config global (autoriza al relayer)
    #[account(seeds=[b"config"], bump = config.bump)]
    pub config: Account<'info, BridgeConfig>,

    // Programas
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    // PDA firmante de Arcium (la misma que usas en deposit)
    #[account(
        mut,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
}

pub fn handler(ctx: Context<ReleaseSpl>, amount: u64) -> Result<()> {
    // Chequeo defensivo (opcional)
    require!(
        ctx.accounts.escrow_token.amount >= amount,
        ErrorCode::InsufficientEscrowBalance
    );

    // Seeds para firmar como PDA
    let bump = ctx.bumps.sign_pda_account;
    let signer_seeds: &[&[u8]] = &[&SIGN_PDA_SEED, &[bump]];

    // Transferencia SPL (escrow -> recipient ATA)
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

    emit!(IncomingBridgeDelivered {
        recipient: ctx.accounts.recipient.key(),
        token: ctx.accounts.mint.key(),
        amount,
    });

    Ok(())
}
