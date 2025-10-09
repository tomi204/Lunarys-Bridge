// programs/contracts/src/instructions/release_spl.rs
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self as token, Mint, Token, TokenAccount, TransferChecked};
use arcium_anchor::prelude::*;

use crate::constants::COMP_DEF_OFFSET_PLAN_PAYOUT;
use crate::errors::ErrorCode;
use crate::{SignerAccount, ID_CONST};

#[derive(Accounts)]
pub struct ReleaseSpl<'info> {
    /// Payer de las rent/ATAs si hiciera falta crearlas
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Mint del token (USDC/USDT)
    pub mint: Account<'info, Mint>,

    /// Escrow que tiene los tokens bloqueados (propiedad = PDA firmante)
    #[account(
        mut,
        constraint = escrow_token.mint == mint.key() @ ErrorCode::InvalidMint,
        // el owner **debe** ser el PDA firmante
        constraint = escrow_token.owner == derive_sign_pda!() @ ErrorCode::InvalidOwner,
    )]
    pub escrow_token: Account<'info, TokenAccount>,

    /// ATA del destinatario (se crea si no existe)
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = recipient,
    )]
    pub recipient_token: Account<'info, TokenAccount>,

    /// Destinatario público (wallet en Solana)
    /// CHECK: solo lo usamos como authority del ATA
    pub recipient: UncheckedAccount<'info>,

    // Arcium (opcional aquí, pero mantenemos mismo patrón de cuentas)
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_PLAN_PAYOUT))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    pub arcium_program: Program<'info, Arcium>,

    // Programas
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    // PDA firmante de Arcium
    #[account(
        mut,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
}

pub fn handler(ctx: Context<ReleaseSpl>, amount: u64) -> Result<()> {
    // Necesitamos que el PDA firme la transferencia
    let bump = ctx.bumps.sign_pda_account;
    let signer_seeds: &[&[u8]] = &[&SIGN_PDA_SEED, &[bump]];

    // CPI: transfer_checked desde el escrow (owner = PDA) al ATA del recipient
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

    Ok(())
}
