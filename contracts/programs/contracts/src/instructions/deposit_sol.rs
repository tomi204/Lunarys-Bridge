use crate::constants::COMP_DEF_OFFSET_PLAN_PAYOUT;
use crate::errors::ErrorCode;
use crate::events::BridgeDeposit;
use crate::state::{BridgeConfig, BridgeRequest};
use crate::{SignerAccount, ID, ID_CONST};

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::spl_token; // for native_mint::id()
use anchor_spl::token::{self as token, SyncNative, Token, TokenAccount};
use arcium_anchor::prelude::*;
use core::mem::size_of;

#[queue_computation_accounts("plan_payout", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, request_id: u64)] // <- include request_id in the ix
pub struct DepositSolAndQueue<'info> {
    // --- Signer / payer ---
    #[account(mut)]
    pub payer: Signer<'info>,

    // --- Global config (fees / claim window / bond) ---
    #[account(seeds=[b"config"], bump = config.bump)]
    pub config: Account<'info, BridgeConfig>,

    // --- Request PDA (pattern B: create it here on deposit) ---
    // seeds = ["request", payer, request_id_le]
    #[account(
        init,
        payer = payer,
        space = 8 + size_of::<BridgeRequest>(),
        seeds = [b"request", payer.key().as_ref(), &request_id.to_le_bytes()],
        bump
    )]
    pub request_pda: Account<'info, BridgeRequest>,

    // --- WSOL vault (TokenAccount with mint = NATIVE_MINT) owned by the signing PDA ---
    #[account(
        mut,
        constraint = escrow_wsol.mint == spl_token::native_mint::id() @ ErrorCode::InvalidMint,
        constraint = escrow_wsol.owner == derive_sign_pda!() @ ErrorCode::InvalidOwner
    )]
    pub escrow_wsol: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,

    // --- Arcium ---
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(mut, address = derive_mempool_pda!())]
    /// CHECK: validated by Arcium
    pub mempool_account: UncheckedAccount<'info>,

    #[account(mut, address = derive_execpool_pda!())]
    /// CHECK: validated by Arcium
    pub executing_pool: UncheckedAccount<'info>,

    #[account(mut, address = derive_comp_pda!(computation_offset))]
    /// CHECK: validated by Arcium
    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_PLAN_PAYOUT))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,

    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,

    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,

    pub arcium_program: Program<'info, Arcium>,
}

#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<DepositSolAndQueue>,
    computation_offset: u64,
    request_id: u64, // <- we will persist this in the PDA
    // Encrypted inputs for MXE
    amount_ct: [u8; 32],
    recipient_tag_ct: [u8; 32],
    pub_key: [u8; 32],
    nonce: u128,
    // Public metadata (optional)
    amount_commitment: [u8; 32],
    recipient_hash: [u8; 32],
    // Gross lamports the user wants to deposit (we'll apply fee)
    amount_lamports: u64,
) -> Result<()> {
    // 0) Compute fee from config and net the amount (like Solidity contract)
    let cfg = &ctx.accounts.config;
    let mut fee = (amount_lamports as u128 * cfg.fee_bps as u128) / 10_000;
    if fee < cfg.min_fee as u128 {
        fee = cfg.min_fee as u128;
    }
    if fee > cfg.max_fee as u128 {
        fee = cfg.max_fee as u128;
    }
    let fee_u64 = u64::try_from(fee).unwrap_or(u64::MAX);
    let amount_net = amount_lamports.saturating_sub(fee_u64);

    // 1) Transfer NET lamports into the WSOL vault (escrow)
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.escrow_wsol.to_account_info(),
            },
        ),
        amount_net,
    )?;

    // 2) Sync WSOL vault to update TokenAccount amount
    token::sync_native(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        SyncNative {
            account: ctx.accounts.escrow_wsol.to_account_info(),
        },
    ))?;

    // 3) Initialize the BridgeRequest PDA and **persist request_id**
    let req = &mut ctx.accounts.request_pda;
    req.request_id = request_id; // <— using it “for real”
    req.payer = ctx.accounts.payer.key();
    req.token_mint = spl_token::native_mint::id(); // WSOL mint
    req.amount_locked = amount_net;
    req.fee_locked = fee_u64;
    req.created_at = Clock::get()?.unix_timestamp;
    req.claimed = false;
    req.solver = Pubkey::default();
    req.claim_deadline = 0;
    req.bond_lamports = 0;
    req.finalized = false;
    req.bump = ctx.bumps.request_pda;

    // Optional: log for easy tracing in explorers
    msg!("request_id (u64) = {}", request_id);

    // 4) Emit a public event (you can add request_id in your event type if you want)
    emit!(BridgeDeposit {
        deposit_id: ctx.accounts.computation_account.key().to_bytes(),
        amount_commitment,
        recipient_hash,
        nonce,
        ts: Clock::get()?.unix_timestamp as u64,
    });

    // 5) Queue the confidential computation (unchanged)
    ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

    let args = vec![
        Argument::ArcisPubkey(pub_key),
        Argument::PlaintextU128(nonce),
        Argument::EncryptedU64(amount_ct),
        Argument::EncryptedU64(recipient_tag_ct),
    ];

    queue_computation(
        ctx.accounts,
        computation_offset,
        args,
        None,
        vec![super::callback::PlanPayoutCallback::callback_ix(&[])],
    )?;

    Ok(())
}
