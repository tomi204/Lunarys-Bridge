use crate::events::BridgeDeposit;
use crate::{
    constants::COMP_DEF_OFFSET_PLAN_PAYOUT, errors::ErrorCode, SignerAccount, ID, ID_CONST,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self as token, Mint, Token, TokenAccount, TransferChecked};
use arcium_anchor::prelude::*;

#[queue_computation_accounts("plan_payout", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct DepositAndQueue<'info> {
    // --- Signer/payer ---
    #[account(mut)]
    pub payer: Signer<'info>,

    // --- Classic SLP (USDC/USDT) ---
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

    // Encrypted amount, Encrypted recipient_tag
    amount_ct: [u8; 32],
    recipient_tag_ct: [u8; 32],
    pub_key: [u8; 32],
    nonce: u128,

    // Public metadata optional
    amount_commitment: [u8; 32],
    recipient_hash: [u8; 32],

    // Visible amount (without confidentiality)
    amount: u64,
) -> Result<()> {
    // 1) Lock SPL en escrow
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

    // 2 Minimum public event
    emit!(BridgeDeposit {
        deposit_id: ctx.accounts.computation_account.key().to_bytes(),
        amount_commitment,
        recipient_hash,
        nonce,
        ts: Clock::get()?.unix_timestamp as u64,
    });

    // 3 Queue confidential computation
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
