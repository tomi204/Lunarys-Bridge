use crate::errors::ErrorCode;
use crate::events::BridgePaidToSolver;
use crate::instructions::claim_request::BOND_VAULT_SEED; // same seed as in claim_request
use crate::{SignerAccount, ID_CONST};

use crate::state::{BridgeConfig, BridgeRequest};
use anchor_lang::prelude::*;
use anchor_spl::token::{self as token, Mint, Token, TokenAccount, TransferChecked};
// Importa el prelude de Arcium (trae SIGN_PDA_SEED y derive_sign_pda!)
use arcium_anchor::prelude::*;

/// Pays the winning solver with (amount_locked + fee_locked),
/// refunds the solver's bond, and finalizes the request.
/// Authorization: only the relayer (we use `config.owner` as relayer).
#[derive(Accounts)]
#[instruction(request_id: u64)]
pub struct VerifyAndSettleSpl<'info> {
    /// Relayer / verifier (must match config.owner). In Solidity: onlyRelayer.
    #[account(mut, address = config.owner)]
    pub relayer: Signer<'info>,

    /// Global config (fees, claim window, min bond, slash params, owner/relayer).
    #[account(seeds=[b"config"], bump = config.bump)]
    pub config: Account<'info, BridgeConfig>,

    /// The BridgeRequest being settled. Variant B seeds (uses external request_owner).
    #[account(
        mut,
        seeds = [b"request", request_owner.key().as_ref(), &request_id.to_le_bytes()],
        bump = request_pda.bump
    )]
    pub request_pda: Account<'info, BridgeRequest>,

    /// Originator of the request (only for seeds in Variant B).
    /// CHECK: seeds-only
    pub request_owner: UncheckedAccount<'info>,

    /// SPL mint for the escrowed token (e.g., USDC).
    pub mint: Account<'info, Mint>,

    /// Program's escrow vault that currently holds the locked tokens.
    #[account(
        mut,
        constraint = escrow_token.mint == mint.key() @ ErrorCode::InvalidMint,
        // Alineado: la vault debe ser owned por el signing PDA del programa
        constraint = escrow_token.owner == sign_pda_account.key() @ ErrorCode::InvalidOwner
    )]
    pub escrow_token: Account<'info, TokenAccount>,

    /// Winner solver's token account (receiver). Must match mint and owner.
    #[account(
        mut,
        constraint = solver_token.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = solver_token.owner == request_pda.solver @ ErrorCode::InvalidOwner
    )]
    pub solver_token: Account<'info, TokenAccount>,

    /// PDA that signs SPL transfers out of escrow (same one used in deposit_*).
    #[account(
        mut,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,

    /// PDA that currently holds the solver's bond in lamports.
    #[account(
        mut,
        seeds = [BOND_VAULT_SEED, &request_id.to_le_bytes()],
        bump
    )]
    pub bond_vault: SystemAccount<'info>,

    /// The same solver recorded in the request; will receive the bond refund.
    /// CHECK: validated at runtime to equal `request_pda.solver`.
    #[account(mut)]
    pub solver_wallet: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<VerifyAndSettleSpl>,
    _request_id: u64,
    dest_tx_hash: [u8; 32],  // off-chain evidence inputs (not stored)
    evidence_hash: [u8; 32], // ditto; you may log them
) -> Result<()> {
    let req = &mut ctx.accounts.request_pda;

    // --- Authorization / guards (mirror Solidity: OnlyRelayer + status checks) ---
    // already enforced by `address = config.owner` on `relayer`.
    require!(!req.finalized, ErrorCode::RequestAlreadyFinalized);
    require!(req.claimed, ErrorCode::NoClaim);

    // Optional: require the claim NOT to be expired at this point.
    let now = Clock::get()?.unix_timestamp;
    require!(now <= req.claim_deadline, ErrorCode::ClaimExpired);

    // Solver wallet must match the recorded solver.
    require_keys_eq!(
        ctx.accounts.solver_wallet.key(),
        req.solver,
        ErrorCode::InvalidOwner
    );

    // --- Compute payout = net amount + fee (parity with EVM escrow+fee payout) ---
    let payout = req
        .amount_locked
        .checked_add(req.fee_locked)
        .ok_or(ErrorCode::MathOverflow)?;

    // --- SPL transfer from escrow → solver ---
    // FIX: no usar temporales en signer seeds; materializamos el bump en una var local estable
    let bump: u8 = ctx.bumps.sign_pda_account;
    let bump_seed: [u8; 1] = [bump];
    let signer_seeds: &[&[u8]] = &[&SIGN_PDA_SEED, &bump_seed];
    let signer: &[&[&[u8]]] = &[signer_seeds];

    let cpi = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.escrow_token.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.solver_token.to_account_info(),
            authority: ctx.accounts.sign_pda_account.to_account_info(),
        },
        signer,
    );
    token::transfer_checked(cpi, payout, ctx.accounts.mint.decimals)?;

    // --- Refund solver's bond from bond_vault (full refund on success) ---
    let bond = req.bond_lamports;
    if bond > 0 {
        // subtract from vault
        **ctx
            .accounts
            .bond_vault
            .to_account_info()
            .try_borrow_mut_lamports()? -= bond;

        // add to solver
        **ctx
            .accounts
            .solver_wallet
            .to_account_info()
            .try_borrow_mut_lamports()? += bond;
    }

    // --- Finalize and clear claim state (free for indexing) ---
    req.finalized = true;
    req.claimed = false;
    req.solver = Pubkey::default();
    req.claim_deadline = 0;
    req.bond_lamports = 0;

    // Evento para indexar (simétrico al EVM BridgePaidToSolver)
    emit!(BridgePaidToSolver {
        request_id: _request_id,
        solver: ctx.accounts.solver_wallet.key(),
        token_mint: ctx.accounts.mint.key(),
        payout,
    });

    // Logs opcionales (útiles en devnet/testing)
    msg!(
        "verify_and_settle OK: dest_tx_hash={:?} evidence_hash={:?}",
        dest_tx_hash,
        evidence_hash
    );
    Ok(())
}
