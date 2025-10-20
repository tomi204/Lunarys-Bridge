use anchor_lang::prelude::*;
use anchor_spl::token::{self as token, Mint, Token, TokenAccount, TransferChecked};
use arcium_anchor::prelude::*;
use core::mem::size_of;

use crate::errors::ErrorCode;
use crate::events::BridgeInitiated;
use crate::state::BridgeRequest;
use crate::{constants::COMP_DEF_OFFSET_PLAN_PAYOUT, SignerAccount, ID, ID_CONST};

#[queue_computation_accounts("plan_payout", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, request_id: u64)]
pub struct DepositAndQueue<'info> {
    // --- Signer/payer ---
    #[account(mut)]
    pub payer: Signer<'info>,

    // --- Classic SPL (USDC/USDT) ---
    #[account(
        mut,
        constraint = user_token.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = user_token.owner == payer.key() @ ErrorCode::InvalidOwner
    )]
    pub user_token: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = escrow_token.mint == mint.key() @ ErrorCode::InvalidMint
    )]
    pub escrow_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,

    // --- Global config (fees/windows/bond) ---
    #[account(seeds=[b"config"], bump = config.bump)]
    pub config: Account<'info, crate::state::BridgeConfig>,

    // --- Request PDA ---
    #[account(
        init,
        payer = payer,
        space = 8 + size_of::<BridgeRequest>(),
        seeds = [b"request", payer.key().as_ref(), &request_id.to_le_bytes()],
        bump
    )]
    pub request_pda: Account<'info, BridgeRequest>,

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
    /// CHECK: validated for the Arcium program
    pub mempool_account: UncheckedAccount<'info>,

    #[account(mut, address = derive_execpool_pda!())]
    /// CHECK: validated for the Arcium program
    pub executing_pool: UncheckedAccount<'info>,

    #[account(mut, address = derive_comp_pda!(computation_offset))]
    /// CHECK: validated for the Arcium program
    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_PLAN_PAYOUT))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,

    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,

    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<DepositAndQueue>,
    computation_offset: u64,
    request_id: u64,
    // Client encryption material (for possible reseal in claim)
    client_pubkey: [u8; 32], // client's ephemeral x25519
    nonce: [u8; 16],         // RescueCipher nonce (16 bytes, LE)
    // u256 LE destination split into 4 encrypted u64 words (no EncryptedU256 in the SDK)
    destination_ct0: [u8; 32], // bytes 0..7  (u64 #0)
    destination_ct1: [u8; 32], // bytes 8..15 (u64 #1)
    destination_ct2: [u8; 32], // bytes 16..23(u64 #2)
    destination_ct3: [u8; 32], // bytes 24..31(u64 #3)
    // Amount in plaintext (as in Solidity)
    amount: u64,
) -> Result<()> {
    // 0) Fee and net amount
    let cfg = &ctx.accounts.config;
    let mut fee = (amount as u128 * cfg.fee_bps as u128) / 10_000;
    if fee < cfg.min_fee as u128 {
        fee = cfg.min_fee as u128;
    }
    if fee > cfg.max_fee as u128 {
        fee = cfg.max_fee as u128;
    }
    // (safe) if fee >= amount, it falls to a 50% hard cap
    if fee as u64 >= amount {
        fee = (amount / 2) as u128;
    }
    let fee_u64 = u64::try_from(fee).unwrap_or(u64::MAX);
    let amount_net = amount.saturating_sub(fee_u64);

    // 1) Lock total SPL (net + fee) in the vault
    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.escrow_token.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    // 2) Initialize Request PDA
    let req = &mut ctx.accounts.request_pda;
    req.payer = ctx.accounts.payer.key();
    req.token_mint = ctx.accounts.mint.key();
    req.amount_locked = amount_net;
    req.fee_locked = fee_u64;
    req.created_at = Clock::get()?.unix_timestamp;
    req.claimed = false;
    req.solver = Pubkey::default();
    req.claim_deadline = 0;
    req.bond_lamports = 0;
    req.finalized = false;
    req.bump = ctx.bumps.request_pda;

    // --- We persist material for reseal in `claim` (symmetry with FHE.allow) ---
    let nonce_u128 = u128::from_le_bytes(nonce);
    req.client_pubkey = client_pubkey;
    req.nonce_le = nonce_u128;
    req.dest_ct_w0 = destination_ct0;
    req.dest_ct_w1 = destination_ct1;
    req.dest_ct_w2 = destination_ct2;
    req.dest_ct_w3 = destination_ct3;

    // 3) Minimum event (pair with Solidity)
    emit!(BridgeInitiated {
        request_id,
        sender: ctx.accounts.payer.key(),
        token: ctx.accounts.mint.key(),
        amount_after_fee: amount_net,
        fee: fee_u64,
        ts: Clock::get()?.unix_timestamp as u64,
    });

    // 4) Queue of the confidential computation (plan_payout)
    ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

    let args = vec![
        Argument::ArcisPubkey(client_pubkey),
        Argument::PlaintextU128(nonce_u128),
        // 4 encrypted u64 words (to match the plan_payout circuit: DestWords)
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
