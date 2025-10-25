// programs/contracts/src/instructions/deposit.rs
use crate::{ID, ID_CONST};
use anchor_lang::prelude::*;
use anchor_spl::token::{self as token, Mint, Token, TokenAccount, TransferChecked};
use arcium_anchor::prelude::*;
use core::mem::size_of;

use crate::errors::ErrorCode;
use crate::events::BridgeInitiated;
use crate::state::{BridgeConfig, BridgeRequest};
use crate::{constants::COMP_DEF_OFFSET_PLAN_PAYOUT, SignerAccount};

// ✅ Mantén el macro; Arcium genera los traits/validaciones del CPI
#[queue_computation_accounts("plan_payout", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, request_id: u64)]
pub struct DepositAndQueue<'info> {
    // --- Signer/payer ---
    #[account(mut)]
    pub payer: Signer<'info>,

    // --- SPL (USDC/USDT) ---
    #[account(
        mut,
        constraint = user_token.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = user_token.owner == payer.key() @ ErrorCode::InvalidOwner
    )]
    pub user_token: Box<Account<'info, TokenAccount>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = escrow_token.mint == mint.key() @ ErrorCode::InvalidMint
    )]
    pub escrow_token: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,

    // --- Global config ---
    #[account(seeds=[b"config"], bump = config.bump)]
    pub config: Box<Account<'info, BridgeConfig>>,

    // --- Request PDA ---
    #[account(
        init,
        payer = payer,
        space = 8 + size_of::<BridgeRequest>(),
        seeds = [b"request", payer.key().as_ref(), &request_id.to_le_bytes()],
        bump
    )]
    pub request_pda: Box<Account<'info, BridgeRequest>>,

    // --- Signer PDA propio del bridge ---
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Box<Account<'info, SignerAccount>>,

    // ---------- Arcium ----------
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(mut, address = derive_mempool_pda!())]
    /// CHECK: validated by address constraint
    pub mempool_account: UncheckedAccount<'info>,

    #[account(mut, address = derive_execpool_pda!())]
    /// CHECK: validated by address constraint
    pub executing_pool: UncheckedAccount<'info>,

    // ✅ RESTAURAR el constraint oficial de Arcium:
    //    el programa de Arcium validará las seeds/offset aquí.
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    /// CHECK: checked by the address constraint
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

// ❌ Elimina por completo cualquier helper/validación manual,
//    incluido comp_pda_exact(...) y los msg!/require_keys_eq! en el handler.

#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<DepositAndQueue>,
    computation_offset: u64,
    request_id: u64,
    // Material de cliente
    client_pubkey: [u8; 32],
    nonce: [u8; 16],
    destination_ct0: [u8; 32],
    destination_ct1: [u8; 32],
    destination_ct2: [u8; 32],
    destination_ct3: [u8; 32],
    amount: u64,
) -> Result<()> {
    // 0) Fees
    let cfg = &ctx.accounts.config;
    let mut fee = (amount as u128 * cfg.fee_bps as u128) / 10_000;
    if fee < cfg.min_fee as u128 {
        fee = cfg.min_fee as u128;
    }
    if fee > cfg.max_fee as u128 {
        fee = cfg.max_fee as u128;
    }
    if fee as u64 >= amount {
        fee = (amount / 2) as u128;
    }
    let fee_u64 = u64::try_from(fee).unwrap_or(u64::MAX);
    let amount_net = amount.saturating_sub(fee_u64);

    // 1) Lock SPL
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

    // 2) Inicializa Request PDA
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

    let nonce_u128 = u128::from_le_bytes(nonce);
    req.client_pubkey = client_pubkey;
    req.nonce_le = nonce_u128;
    req.dest_ct_w0 = destination_ct0;
    req.dest_ct_w1 = destination_ct1;
    req.dest_ct_w2 = destination_ct2;
    req.dest_ct_w3 = destination_ct3;

    // 3) Evento
    emit!(BridgeInitiated {
        request_id,
        sender: ctx.accounts.payer.key(),
        token: ctx.accounts.mint.key(),
        amount_after_fee: amount_net,
        fee: fee_u64,
        ts: Clock::get()?.unix_timestamp as u64,
    });

    // 4) Queue Arcium (plan_payout)
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
