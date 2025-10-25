use crate::errors::ErrorCode;
use crate::{constants::COMP_DEF_OFFSET_PLAN_PAYOUT, SignerAccount};
use crate::{ID, ID_CONST};
use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

#[queue_computation_accounts("plan_payout", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct QueuePlanPayout<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,

    // TIPOS EXACTOS que exige el macro:
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(mut, address = derive_mempool_pda!())]
    /// CHECK: validada por constraint
    pub mempool_account: UncheckedAccount<'info>,

    #[account(mut, address = derive_execpool_pda!())]
    /// CHECK: validada por constraint
    pub executing_pool: UncheckedAccount<'info>,

    #[account(mut)]
    /// CHECK: Arcium valida seeds en el CPI (QueueComputation)
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

pub fn handler(
    ctx: Context<QueuePlanPayout>,
    computation_offset: u64,
    pub_key: [u8; 32],
    nonce: u128,
    amount_ct: [u8; 32],
    recipient_tag_ct: [u8; 32],
) -> Result<()> {
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
    )
}
