// programs/contracts/src/instructions/release_sol.rs
use crate::errors::ErrorCode;
use crate::events::IncomingBridgeDelivered;
use crate::state::BridgeConfig;
use crate::{SignerAccount, ID_CONST};

use anchor_lang::prelude::*;
use anchor_spl::token::{self as token, spl_token, CloseAccount, Token, TokenAccount, Transfer};
use arcium_anchor::prelude::*;

/// Libera WSOL desde el escrow (owner = PDA firmante) hacia una cuenta WSOL del receptor.
/// Si el escrow queda en 0, opcionalmente se cierra para recuperar renta.
#[derive(Accounts)]
pub struct ReleaseSol<'info> {
    /// Relayer autorizado (debe ser el owner en config)
    #[account(mut, address = config.owner)]
    pub relayer: Signer<'info>,

    /// Config global (solo para autorizar al relayer)
    #[account(seeds=[b"config"], bump = config.bump)]
    pub config: Account<'info, BridgeConfig>,

    /// Escrow WSOL (mint = NATIVE_MINT) propiedad de la PDA firmante
    #[account(
        mut,
        constraint = escrow_wsol.mint == spl_token::native_mint::id() @ ErrorCode::InvalidMint,
        constraint = escrow_wsol.owner == derive_sign_pda!() @ ErrorCode::InvalidOwner
    )]
    pub escrow_wsol: Box<Account<'info, TokenAccount>>, // ⬅️ Box para bajar stack

    /// Cuenta WSOL del receptor (puede ser su ATA o cualquier TokenAccount WSOL)
    #[account(
        mut,
        constraint = recipient_wsol.mint == spl_token::native_mint::id() @ ErrorCode::InvalidMint,
        constraint = recipient_wsol.owner == recipient.key() @ ErrorCode::InvalidOwner
    )]
    pub recipient_wsol: Box<Account<'info, TokenAccount>>,

    /// Wallet pública del receptor (dueña de `recipient_wsol`)
    /// CHECK: solo se usa para constraint/event
    pub recipient: UncheckedAccount<'info>,

    /// Destino de renta si se cierra el escrow
    /// CHECK: solo recibe lamports del CloseAccount
    #[account(mut)]
    pub escrow_refund_destination: UncheckedAccount<'info>,

    /// PDA firmante de Arcium (misma usada en depósito)
    #[account(
        mut,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,

    pub token_program: Program<'info, Token>,
    // Puedes omitir `system_program` si no lo usas explícitamente
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ReleaseSol>, amount: u64) -> Result<()> {
    // 0) Chequeo defensivo: balance suficiente en escrow
    require!(
        ctx.accounts.escrow_wsol.amount >= amount,
        ErrorCode::InsufficientEscrowBalance
    );

    // 1) Transferencia WSOL (escrow -> recipient_wsol) firmada por la PDA
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

    // 2) Opcional: si queda en 0, cierra la cuenta para recuperar renta
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

    // 3) Evento espejo
    emit!(IncomingBridgeDelivered {
        recipient: ctx.accounts.recipient.key(),
        token: spl_token::native_mint::id(),
        amount,
    });

    Ok(())
}
