use crate::errors::ErrorCode;
use crate::events::{BridgePaidToSolver, BridgeVerifiedUrl};
use crate::instructions::claim_bridge::BOND_VAULT_SEED;
use crate::state::{BridgeConfig, BridgeRequest};
use crate::{SignerAccount, ID_CONST};

use anchor_lang::prelude::*;
use anchor_spl::token::{self as token, Mint, Token, TokenAccount, TransferChecked};
use arcium_anchor::prelude::*;

/// Verifies off-chain and settles on-chain.
/// Authorization: only the relayer (we use `config.owner`).
#[derive(Accounts)]
#[instruction(request_id: u64)]
pub struct VerifyAndSettleSpl<'info> {
    /// Relayer/verifier. Must be the configured owner.
    #[account(mut, address = config.owner)]
    pub relayer: Signer<'info>,

    /// Global config (pequeña)
    #[account(seeds=[b"config"], bump = config.bump)]
    pub config: Account<'info, BridgeConfig>,

    /// Request to settle (PUEDE SER GRANDE) -> Box para evitar copiar al stack
    #[account(
        mut,
        seeds = [b"request", request_owner.key().as_ref(), &request_id.to_le_bytes()],
        bump = request_pda.bump
    )]
    pub request_pda: Box<Account<'info, BridgeRequest>>,

    /// Solo para seeds
    /// CHECK: seeds-only
    pub request_owner: UncheckedAccount<'info>,

    /// Mint del token (mediana) -> Box
    pub mint: Box<Account<'info, Mint>>,

    /// Vault con los tokens (owner = PDA signer) (mediana) -> Box
    #[account(
        mut,
        constraint = escrow_token.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = escrow_token.owner == sign_pda_account.key() @ ErrorCode::InvalidOwner
    )]
    pub escrow_token: Box<Account<'info, TokenAccount>>,

    /// Token account del solver (mediana) -> Box
    #[account(
        mut,
        constraint = solver_token.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = solver_token.owner == request_pda.solver @ ErrorCode::InvalidOwner
    )]
    pub solver_token: Box<Account<'info, TokenAccount>>,

    /// PDA signer (misma que en deposit)
    #[account(
        mut,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,

    /// Vault (System) con el bond del solver
    #[account(
        mut,
        seeds = [BOND_VAULT_SEED, &request_id.to_le_bytes()],
        bump
    )]
    pub bond_vault: SystemAccount<'info>,

    /// Wallet del solver (para devolver bond)
    /// CHECK: se valida contra request_pda.solver
    #[account(mut)]
    pub solver_wallet: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<VerifyAndSettleSpl>,
    request_id: u64,
    dest_tx_hash: [u8; 32],
    evidence_hash: [u8; 32],
    evidence_url: String,
) -> Result<()> {
    let req = &mut ctx.accounts.request_pda;

    // --- checks ---
    require!(!req.finalized, ErrorCode::RequestAlreadyFinalized);
    require!(req.claimed, ErrorCode::NoClaim);

    let now = Clock::get()?.unix_timestamp;
    require!(now <= req.claim_deadline, ErrorCode::ClaimExpired);

    require_keys_eq!(
        ctx.accounts.solver_wallet.key(),
        req.solver,
        ErrorCode::InvalidOwner
    );

    // --- payout = net + fee ---
    let payout = req
        .amount_locked
        .checked_add(req.fee_locked)
        .ok_or(ErrorCode::MathOverflow)?;

    // --- SPL transfer (escrow -> solver) firmado por la PDA ---
    let bump = ctx.bumps.sign_pda_account;
    let signer_seeds: &[&[u8]] = &[&SIGN_PDA_SEED, &[bump]];

    token::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.escrow_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.solver_token.to_account_info(),
                authority: ctx.accounts.sign_pda_account.to_account_info(),
            },
            &[signer_seeds],
        ),
        payout,
        ctx.accounts.mint.decimals,
    )?;

    // --- devolver bond ---
    let bond = req.bond_lamports;
    if bond > 0 {
        **ctx
            .accounts
            .bond_vault
            .to_account_info()
            .try_borrow_mut_lamports()? -= bond;
        **ctx
            .accounts
            .solver_wallet
            .to_account_info()
            .try_borrow_mut_lamports()? += bond;
    }

    // --- finalize ---
    req.finalized = true;
    req.claimed = false;
    req.solver = Pubkey::default();
    req.claim_deadline = 0;
    req.bond_lamports = 0;

    // --- eventos ---
    emit!(BridgeVerifiedUrl {
        request_id,
        relayer: ctx.accounts.relayer.key(),
        dest_tx_hash,
        evidence_hash,
        evidence_url,
    });

    emit!(BridgePaidToSolver {
        request_id,
        solver: ctx.accounts.solver_wallet.key(),
        token_mint: ctx.accounts.mint.key(),
        payout,
    });

    Ok(())
}
