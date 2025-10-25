use crate::constants::COMP_DEF_OFFSET_PLAN_PAYOUT;
use crate::errors::ErrorCode;
use crate::events::BridgeInitiated;
use crate::state::{BridgeConfig, BridgeRequest};
use crate::{SignerAccount, ID, ID_CONST};

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::spl_token;
use anchor_spl::token::{self as token, SyncNative, Token, TokenAccount};
use arcium_anchor::prelude::*;
use core::mem::size_of;

#[queue_computation_accounts("plan_payout", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, request_id: u64)]
pub struct DepositSolAndQueue<'info> {
    // --- Signer / payer ---
    #[account(mut)]
    pub payer: Signer<'info>,

    // --- Global config ---
    #[account(seeds=[b"config"], bump = config.bump)]
    pub config: Box<Account<'info, BridgeConfig>>,

    // --- Request PDA  ---
    #[account(
        init,
        payer = payer,
        space = 8 + size_of::<BridgeRequest>(),
        seeds = [b"request", payer.key().as_ref(), &request_id.to_le_bytes()],
        bump
    )]
    pub request_pda: Box<Account<'info, BridgeRequest>>,

    // --- WSOL vault (mint = NATIVE_MINT) owned by Signer PDA ---
    #[account(
        mut,
        constraint = escrow_wsol.mint == spl_token::native_mint::id() @ ErrorCode::InvalidMint,
        constraint = escrow_wsol.owner == derive_sign_pda!() @ ErrorCode::InvalidOwner
    )]
    pub escrow_wsol: Box<Account<'info, TokenAccount>>,

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
    pub sign_pda_account: Box<Account<'info, SignerAccount>>,

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
    request_id: u64,
    // Client encryption material
    client_pubkey: [u8; 32],
    nonce: [u8; 16],
    destination_ct0: [u8; 32],
    destination_ct1: [u8; 32],
    destination_ct2: [u8; 32],
    destination_ct3: [u8; 32],
    amount_lamports: u64, // GROSS
) -> Result<()> {
    // 0) Fee & net
    let cfg = &ctx.accounts.config;
    let mut fee = (amount_lamports as u128 * cfg.fee_bps as u128) / 10_000;
    if fee < cfg.min_fee as u128 {
        fee = cfg.min_fee as u128;
    }
    if fee > cfg.max_fee as u128 {
        fee = cfg.max_fee as u128;
    }
    if fee as u64 >= amount_lamports {
        fee = (amount_lamports / 2) as u128;
    }
    let fee_u64 = u64::try_from(fee).unwrap_or(u64::MAX);
    let amount_net = amount_lamports.saturating_sub(fee_u64);

    // 1) Wrap SOL -> WSOL vault + sync
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.escrow_wsol.to_account_info(),
            },
        ),
        amount_lamports,
    )?;

    token::sync_native(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        SyncNative {
            account: ctx.accounts.escrow_wsol.to_account_info(),
        },
    ))?;

    // 2) Persist request
    let req = &mut ctx.accounts.request_pda;
    req.request_id = request_id;
    req.payer = ctx.accounts.payer.key();
    req.token_mint = spl_token::native_mint::id(); // WSOL
    req.amount_locked = amount_net;
    req.fee_locked = fee_u64;
    req.created_at = Clock::get()?.unix_timestamp;
    req.claimed = false;
    req.solver = Pubkey::default();
    req.claim_deadline = 0;
    req.bond_lamports = 0;
    req.finalized = false;
    req.bump = ctx.bumps.request_pda;

    let nonce_u128 = u128::from_le_bytes(nonce);
    req.client_pubkey = client_pubkey;
    req.nonce_le = nonce_u128;
    req.dest_ct_w0 = destination_ct0;
    req.dest_ct_w1 = destination_ct1;
    req.dest_ct_w2 = destination_ct2;
    req.dest_ct_w3 = destination_ct3;

    // 3) Event
    emit!(BridgeInitiated {
        request_id,
        sender: ctx.accounts.payer.key(),
        token: spl_token::native_mint::id(),
        amount_after_fee: amount_net,
        fee: fee_u64,
        ts: Clock::get()?.unix_timestamp as u64,
    });

    // 4) Queue computation
    ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

    let args = vec![
        Argument::ArcisPubkey(client_pubkey),
        Argument::PlaintextU128(nonce_u128),
        Argument::EncryptedU64(destination_ct0),
        Argument::EncryptedU64(destination_ct1),
        Argument::EncryptedU64(destination_ct2),
        Argument::EncryptedU64(destination_ct3),
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
