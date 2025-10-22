use crate::constants::COMP_DEF_OFFSET_RESEAL;
use crate::errors::ErrorCode;
use crate::events::BridgeClaimed;
use crate::state::{BridgeConfig, BridgeRequest};
use crate::{SignerAccount, ID, ID_CONST};

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use arcium_anchor::prelude::*;

/// PDA seed for the solver's bond vault:
pub const BOND_VAULT_SEED: &[u8] = b"bond";

/// Claim + reseal (symmetrical with the EVM flow: give access to the solver)
#[queue_computation_accounts("reseal_destination", solver)]
#[derive(Accounts)]
#[instruction(computation_offset_reseal: u64, request_id: u64)]
pub struct ClaimRequest<'info> {
    /// Solver that claims and pays the bond
    #[account(mut)]
    pub solver: Signer<'info>,

    /// Global config
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, BridgeConfig>,

    /// BridgeRequest (Variant B: seeds include external owner)
    #[account(
        mut,
        seeds = [b"request", request_owner.key().as_ref(), &request_id.to_le_bytes()],
        bump = request_pda.bump
    )]
    pub request_pda: Account<'info, BridgeRequest>,

    /// Only for seeds (Variant B)
    /// CHECK: seeds-only
    pub request_owner: UncheckedAccount<'info>,

    /// Vault (System-owned PDA) that holds the bond
    /// CHECK: system-owned, no data (space = 0)
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
    solver_x25519: [u8; 32], // ephemeral x25519 pubkey of the solver (from the front)
) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let req = &mut ctx.accounts.request_pda;
    let now = Clock::get()?.unix_timestamp;

    // --- Checks (EVM parity) ---
    require!(!req.finalized, ErrorCode::AlreadyFinalized);
    if req.claimed {
        // If there is an active claim and it is NOT expired -> block
        require!(now > req.claim_deadline, ErrorCode::ActiveClaim);
    }

    let min_bond = cfg.min_solver_bond;
    require!(min_bond > 0, ErrorCode::BondTooLow);

    // --- Transfer bond to the vault ---
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

    // --- Update request ---
    req.claimed = true;
    req.solver = ctx.accounts.solver.key();
    req.claim_deadline = now
        .checked_add(cfg.claim_window_secs)
        .ok_or(ErrorCode::MathOverflow)?;
    req.bond_lamports = min_bond;

    // --- Public event (as in Solidity) ---
    emit!(BridgeClaimed {
        request_id,
        solver: ctx.accounts.solver.key(),
        bond: min_bond,
        deadline: req.claim_deadline, // i64 in the event
    });

    // === Reseal: give access to the solver ===
    // Use persisted material in BridgeRequest (make sure these fields exist in the struct):
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

    // Reseal without callback
    queue_computation(ctx.accounts, computation_offset_reseal, args, None, vec![])?;

    msg!(
        "request {} claimed + reseal queued (offset={})",
        request_id,
        computation_offset_reseal
    );

    Ok(())
}
