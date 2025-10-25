// programs/contracts/src/instructions/release_expired_claim.rs
use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::events::BridgeClaimExpired;
use crate::state::{BridgeConfig, BridgeRequest};
// Usa el MISMO seed que en claim_request.rs (evita duplicar la constante)
use crate::instructions::claim_bridge::BOND_VAULT_SEED;

#[derive(Accounts)]
#[instruction(request_id: u64)]
pub struct ReleaseExpiredClaim<'info> {
    /// Cualquiera puede llamar (no se crean cuentas aquí).
    pub caller: Signer<'info>,

    /// Config global (slash_bps, owner = slash collector, etc.)
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, BridgeConfig>>,

    /// BridgeRequest (Variante B: incluye request_owner en seeds)
    #[account(
        mut,
        seeds = [b"request", request_owner.key().as_ref(), &request_id.to_le_bytes()],
        bump = request_pda.bump
    )]
    pub request_pda: Box<Account<'info, BridgeRequest>>,

    /// Solo para seeds (Variante B)
    /// CHECK: seeds-only
    pub request_owner: UncheckedAccount<'info>,

    /// PDA que mantiene el bond del solver (lamports)
    #[account(
        mut,
        seeds = [BOND_VAULT_SEED, &request_id.to_le_bytes()],
        bump
    )]
    pub bond_vault: SystemAccount<'info>,

    /// Reembolso va al *solver anterior*. Validado contra request_pda.solver.
    /// CHECK: validado en runtime con require_keys_eq!
    #[account(mut)]
    pub prev_solver: UncheckedAccount<'info>,

    /// Parte del slash va al collector (para simplicidad, config.owner)
    /// CHECK: address validada contra config.owner
    #[account(mut, address = config.owner)]
    pub slash_collector: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<ReleaseExpiredClaim>, request_id: u64) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let req = &mut ctx.accounts.request_pda;

    // --- Guards ---
    require!(req.claimed, ErrorCode::NoClaim);

    let now = Clock::get()?.unix_timestamp;
    // Si aún no expiró, sigue activa -> no liberar
    require!(now > req.claim_deadline, ErrorCode::ActiveClaim);

    // El prev_solver debe coincidir con el solver registrado
    require_keys_eq!(
        ctx.accounts.prev_solver.key(),
        req.solver,
        ErrorCode::InvalidOwner
    );

    // Debe existir bond para repartir
    require!(req.bond_lamports > 0, ErrorCode::BondTooLow);

    // --- Cálculo de slash/refund ---
    let bond = req.bond_lamports as u128;
    let slash = bond
        .checked_mul(cfg.slash_bps as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10_000)
        .ok_or(ErrorCode::MathOverflow)?;
    let refund = bond.checked_sub(slash).ok_or(ErrorCode::MathOverflow)?;

    let slash_u64 = u64::try_from(slash).map_err(|_| ErrorCode::MathOverflow)?;
    let refund_u64 = u64::try_from(refund).map_err(|_| ErrorCode::MathOverflow)?;

    // Sanity: el vault debe tener al menos el bond
    let vault_lamports = **ctx.accounts.bond_vault.to_account_info().lamports.borrow();
    require!(vault_lamports >= req.bond_lamports, ErrorCode::MathOverflow);

    // --- Mover lamports (PDA -> cuentas sistema) ---
    // Resta total del bond al vault
    **ctx
        .accounts
        .bond_vault
        .to_account_info()
        .try_borrow_mut_lamports()? -= req.bond_lamports;

    // Agrega slash al collector
    if slash_u64 > 0 {
        **ctx
            .accounts
            .slash_collector
            .to_account_info()
            .try_borrow_mut_lamports()? += slash_u64;
    }

    // Agrega refund al solver
    if refund_u64 > 0 {
        **ctx
            .accounts
            .prev_solver
            .to_account_info()
            .try_borrow_mut_lamports()? += refund_u64;
    }

    // --- Limpia el estado para permitir un nuevo claim ---
    req.claimed = false;
    req.solver = Pubkey::default();
    req.claim_deadline = 0;
    req.bond_lamports = 0;

    // Evento
    emit!(BridgeClaimExpired {
        request_id,
        solver: ctx.accounts.prev_solver.key(),
        slashed: slash_u64,
    });

    msg!(
        "expired claim released (req={}, slash={}, refund={})",
        request_id,
        slash_u64,
        refund_u64
    );
    Ok(())
}
