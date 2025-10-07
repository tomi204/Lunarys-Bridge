#![allow(unexpected_cfgs)]
#![allow(deprecated)]

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

// --- Types needed in entrypoint signatures ---
use crate::instructions::callback::PlanPayoutOutput;

// --------- Arcium program IDs (declare once) ----------
use arcium_client::idl::arcium as arx;
pub use arx::ID as ARCIUM_PROGRAM_ID;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;

// Re-export handlers and Contexts so entrypoints can delegate cleanly
pub use instructions::{
    deposit_and_queue_handler, init_plan_payout_comp_def_handler, plan_payout_callback_handler,
    queue_plan_payout_handler, DepositAndQueue, InitPlanPayoutCompDef, PlanPayoutCallback,
    QueuePlanPayout,
};

// Aliases the #[arcium_program] macro expects to find at crate root
pub(crate) use instructions::callback::__client_accounts_plan_payout_callback;
pub(crate) use instructions::deposit::__client_accounts_deposit_and_queue;
pub(crate) use instructions::init::__client_accounts_init_plan_payout_comp_def;
pub(crate) use instructions::queue::__client_accounts_queue_plan_payout;

declare_id!("CoCnSp3ooSWqVaaaKiw9WS3fEZ1yXzasta28SfPaUmxD");

#[arcium_program]
pub mod contracts {
    use super::*;

    pub fn init_plan_payout_comp_def(ctx: Context<InitPlanPayoutCompDef>) -> Result<()> {
        init_plan_payout_comp_def_handler(ctx)
    }

    pub fn queue_plan_payout(
        ctx: Context<QueuePlanPayout>,
        computation_offset: u64,
        pub_key: [u8; 32],
        nonce: u128,
        amount_ct: [u8; 32],
        recipient_tag_ct: [u8; 32],
    ) -> Result<()> {
        queue_plan_payout_handler(
            ctx,
            computation_offset,
            pub_key,
            nonce,
            amount_ct,
            recipient_tag_ct,
        )
    }

    pub fn deposit_and_queue(
        ctx: Context<DepositAndQueue>,
        computation_offset: u64,
        amount_ct: [u8; 32],
        recipient_tag_ct: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
        amount_commitment: [u8; 32],
        recipient_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        deposit_and_queue_handler(
            ctx,
            computation_offset,
            amount_ct,
            recipient_tag_ct,
            pub_key,
            nonce,
            amount_commitment,
            recipient_hash,
            amount,
        )
    }

    #[arcium_callback(encrypted_ix = "plan_payout")]
    pub fn plan_payout_callback(
        ctx: Context<PlanPayoutCallback>,
        output: ComputationOutputs<PlanPayoutOutput>,
    ) -> Result<()> {
        plan_payout_callback_handler(ctx, output)
    }
}
