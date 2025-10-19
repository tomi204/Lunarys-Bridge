use crate::constants::COMP_DEF_OFFSET_RESEAL;
use crate::errors::ErrorCode;
use crate::events::BridgeClaimed;
use crate::state::{BridgeConfig, BridgeRequest};
use crate::{SignerAccount, ID, ID_CONST};

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use arcium_anchor::prelude::*;

/// PDA seed para la bóveda del bono del solver:
pub const BOND_VAULT_SEED: &[u8] = b"bond";

/// Claim + reseal (simétrico con el flujo EVM: dar acceso al solver)
#[queue_computation_accounts("reseal_destination", solver)]
#[derive(Accounts)]
#[instruction(computation_offset_reseal: u64, request_id: u64)]
pub struct ClaimRequest<'info> {
    /// Solver que reclama y paga bond
    #[account(mut)]
    pub solver: Signer<'info>,

    /// Config global
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, BridgeConfig>,

    /// BridgeRequest (Variant B: seeds incluyen dueño externo)
    #[account(
        mut,
        seeds = [b"request", request_owner.key().as_ref(), &request_id.to_le_bytes()],
        bump = request_pda.bump
    )]
    pub request_pda: Account<'info, BridgeRequest>,

    /// Sólo para seeds (Variant B)
    /// CHECK: seeds-only
    pub request_owner: UncheckedAccount<'info>,

    /// Bóveda (System-owned PDA) que custodia el bond
    /// CHECK: system-owned, sin datos (space = 0)
    #[account(
        init_if_needed,
        payer = solver,
        space = 0,
        seeds = [BOND_VAULT_SEED, &request_id.to_le_bytes()],
        bump
    )]
    pub bond_vault: UncheckedAccount<'info>,

    // ---- Arcium (reseal) ----
    #[account(
        init_if_needed,
        space = 9,
        payer = solver,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(mut, address = derive_mempool_pda!())]
    /// CHECK: validado por Arcium
    pub mempool_account: UncheckedAccount<'info>,

    #[account(mut, address = derive_execpool_pda!())]
    /// CHECK: validado por Arcium
    pub executing_pool: UncheckedAccount<'info>,

    #[account(mut, address = derive_comp_pda!(computation_offset_reseal))]
    /// CHECK: validado por Arcium
    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_RESEAL))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,

    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,

    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,

    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ClaimRequest>,
    computation_offset_reseal: u64,
    request_id: u64,
    solver_x25519: [u8; 32], // pubkey x25519 efímera del solver (del front)
) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let req = &mut ctx.accounts.request_pda;
    let now = Clock::get()?.unix_timestamp;

    // --- Checks (paridad con EVM) ---
    require!(!req.finalized, ErrorCode::AlreadyFinalized);
    if req.claimed {
        // Si hay claim activo y NO está expirado → bloquear
        require!(now > req.claim_deadline, ErrorCode::ActiveClaim);
    }

    let min_bond = cfg.min_solver_bond;
    require!(min_bond > 0, ErrorCode::BondTooLow);

    // --- Transferir bond al vault ---
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.solver.to_account_info(),
                to: ctx.accounts.bond_vault.to_account_info(),
            },
        ),
        min_bond,
    )?;

    // --- Actualizar request ---
    req.claimed = true;
    req.solver = ctx.accounts.solver.key();
    req.claim_deadline = now
        .checked_add(cfg.claim_window_secs)
        .ok_or(ErrorCode::MathOverflow)?;
    req.bond_lamports = min_bond;

    // --- Event público (como en Solidity) ---
    emit!(BridgeClaimed {
        request_id,
        solver: ctx.accounts.solver.key(),
        bond: min_bond,
        deadline: req.claim_deadline, // i64 en el event
    });

    // === Reseal: dar acceso al solver ===
    // Usa material persistido en BridgeRequest (asegúrate de que existan estos campos en el struct):
    //   client_pubkey: [u8;32]
    //   nonce_le: u128
    //   dest_ct_w0..w3: [u8;32]
    ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

    let args = vec![
        Argument::ArcisPubkey(solver_x25519),
        Argument::PlaintextU128(req.nonce_le),
        Argument::EncryptedU64(req.dest_ct_w0),
        Argument::EncryptedU64(req.dest_ct_w1),
        Argument::EncryptedU64(req.dest_ct_w2),
        Argument::EncryptedU64(req.dest_ct_w3),
    ];

    // Reseal sin callback
    queue_computation(ctx.accounts, computation_offset_reseal, args, None, vec![])?;

    msg!(
        "request {} claimed + reseal queued (offset={})",
        request_id,
        computation_offset_reseal
    );

    Ok(())
}
