use crate::constants::COMP_DEF_OFFSET_PLAN_PAYOUT;
use crate::errors::ErrorCode;
use crate::events::BridgeDeposit;
use crate::{SignerAccount, ID, ID_CONST};

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::spl_token;
use anchor_spl::token::{self as token, SyncNative, Token, TokenAccount};
use arcium_anchor::prelude::*;

#[queue_computation_accounts("plan_payout", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct DepositSolAndQueue<'info> {
    // --- Signer / payer ---
    #[account(mut)]
    pub payer: Signer<'info>,

    // --- WSOL vault (TokenAccount with mint = NATIVE_MINT) ---
    // It has to exist previously and be owned by the signing PDA
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

    pub arcium_program: Program<'info, Arcium>,
}

#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<DepositSolAndQueue>,
    computation_offset: u64,

    // Encrypted inputs for MXE (same as SPL)
    amount_ct: [u8; 32],        // EncryptedU64(amount)
    recipient_tag_ct: [u8; 32], // EncryptedU64(recipient_tag)
    pub_key: [u8; 32],
    nonce: u128,

    // Public metadata optional
    amount_commitment: [u8; 32],
    recipient_hash: [u8; 32],

    // Native SOL that will be wrapped into WSOL
    amount_lamports: u64,
) -> Result<()> {
    // 1 = Transfer native SOL to WSOL vault (TokenAccount)
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

    // 2 = Sync WSOL vault (Update TokenAccount amount field)
    token::sync_native(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        SyncNative {
            account: ctx.accounts.escrow_wsol.to_account_info(),
        },
    ))?;

    // 3 = Public event ( Parity with deposit instruction)
    emit!(BridgeDeposit {
        // Can be use the comp account as ID
        deposit_id: ctx.accounts.computation_account.key().to_bytes(),
        amount_commitment,
        recipient_hash,
        nonce,
        ts: Clock::get()?.unix_timestamp as u64,
    });

    // 4 = Queue confidential computation
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
