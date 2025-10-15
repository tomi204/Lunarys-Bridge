use crate::errors::ErrorCode;
use crate::state::{BridgeConfig, BridgeRequest};
use anchor_lang::prelude::*;
use anchor_lang::system_program;

/// PDA seed for the solver’s bond vault:
/// bond_vault = PDA(program, ["bond", request_id_le])
pub const BOND_VAULT_SEED: &[u8] = b"bond";

#[derive(Accounts)]
#[instruction(request_id: u64)]
pub struct ClaimRequest<'info> {
    /// Solver claims the request and pays the bond (plus rent if vault is created)
    #[account(mut)]
    pub solver: Signer<'info>,

    /// Global config (fees, claim window, min bond, slash, owner, etc.)
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, BridgeConfig>,

    /// BridgeRequest PDA (Variant B: seeds include external `request_owner`)
    #[account(
        mut,
        seeds = [b"request", request_owner.key().as_ref(), &request_id.to_le_bytes()],
        bump = request_pda.bump
    )]
    pub request_pda: Account<'info, BridgeRequest>,

    /// Only for seeds; in Variant A you wouldn’t need this.
    /// CHECK: seeds-only
    pub request_owner: UncheckedAccount<'info>,

    /// System-owned PDA that will custody the bond lamports (created if needed).
    /// No data stored, only lamports; address fixed by seeds+bump.
    /// CHECK: This is a system-owned PDA used only to hold lamports
    #[account(
        init_if_needed,
        payer = solver,
        space = 0,
        seeds = [BOND_VAULT_SEED, &request_id.to_le_bytes()],
        bump
    )]
    pub bond_vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimRequest>, request_id: u64) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let req = &mut ctx.accounts.request_pda;
    let now = Clock::get()?.unix_timestamp;

    // 1) must not be finalized
    require!(!req.finalized, ErrorCode::AlreadyFinalized);

    // 2) if already claimed and not expired → block
    if req.claimed {
        require!(now > req.claim_deadline, ErrorCode::ActiveClaim);
        // Slashing is handled in `release_expired_claim`.
    }

    // 3) min bond > 0
    let min_bond = cfg.min_solver_bond;
    require!(min_bond > 0, ErrorCode::BondTooLow);

    // 4) transfer lamports bond from solver → bond_vault PDA
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

    // 5) update request state
    req.claimed = true;
    req.solver = ctx.accounts.solver.key();
    req.claim_deadline = now
        .checked_add(cfg.claim_window_secs)
        .ok_or(ErrorCode::MathOverflow)?;
    req.bond_lamports = min_bond;

    msg!(
        "request {} claimed by {} until {} (bond = {})",
        request_id,
        req.solver,
        req.claim_deadline,
        req.bond_lamports
    );

    Ok(())
}
