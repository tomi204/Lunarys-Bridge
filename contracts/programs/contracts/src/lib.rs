#![allow(unexpected_cfgs)]
#![allow(deprecated)]

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

// Types needed in entrypoint signatures
use crate::instructions::callback::PlanPayoutOutput;

// Arcium program IDs (declare once)
use arcium_client::idl::arcium as arx;
pub use arx::ID as ARCIUM_PROGRAM_ID;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

// Re-export handlers & Contexts so entrypoints can delegate cleanly
pub use instructions::{
    // deposits
    deposit_and_queue_handler,
    deposit_sol_and_queue_handler,
    init_config_handler,
    // init / queue / callback
    init_plan_payout_comp_def_handler,
    init_request_handler,
    plan_payout_callback_handler,
    queue_plan_payout_handler,
    release_sol_handler,
    // releases
    release_spl_handler,
    set_config_handler,
    // Context types
    DepositAndQueue,
    DepositSolAndQueue,
    InitConfig,
    InitPlanPayoutCompDef,
    InitRequest,
    PlanPayoutCallback,
    QueuePlanPayout,
    ReleaseSol,
    ReleaseSpl,
    SetConfig,
};

// Aliases the #[arcium_program] macro expects at crate root
pub(crate) use instructions::callback::__client_accounts_plan_payout_callback;
pub(crate) use instructions::config_init::__client_accounts_init_config;
pub(crate) use instructions::config_set::__client_accounts_set_config;
pub(crate) use instructions::deposit::__client_accounts_deposit_and_queue;
pub(crate) use instructions::deposit_sol::__client_accounts_deposit_sol_and_queue;
pub(crate) use instructions::init::__client_accounts_init_plan_payout_comp_def;
pub(crate) use instructions::queue::__client_accounts_queue_plan_payout;
pub(crate) use instructions::release_sol::__client_accounts_release_sol;
pub(crate) use instructions::release_spl::__client_accounts_release_spl;

declare_id!("AfaF8Qe6ZR9kiGhBzJjuyLp6gmBwc7gZBivGhHzxN1by");

#[arcium_program]
pub mod contracts {
    use super::*;

    // ---- Arcium: comp-def init / queue / callback ----
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

    #[arcium_callback(encrypted_ix = "plan_payout")]
    pub fn plan_payout_callback(
        ctx: Context<PlanPayoutCallback>,
        output: ComputationOutputs<PlanPayoutOutput>,
    ) -> Result<()> {
        plan_payout_callback_handler(ctx, output)
    }

    // ---- Deposits (lock) ----
    pub fn deposit_and_queue(
        ctx: Context<DepositAndQueue>,
        computation_offset: u64,
        request_id: u64, // 👈 añade
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
            request_id,
            amount_ct,
            recipient_tag_ct,
            pub_key,
            nonce,
            amount_commitment,
            recipient_hash,
            amount,
        )
    }

    pub fn deposit_sol_and_queue(
        ctx: Context<DepositSolAndQueue>,
        computation_offset: u64,
        amount_ct: [u8; 32],
        recipient_tag_ct: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
        amount_commitment: [u8; 32],
        recipient_hash: [u8; 32],
        lamports: u64,
    ) -> Result<()> {
        deposit_sol_and_queue_handler(
            ctx,
            computation_offset,
            amount_ct,
            recipient_tag_ct,
            pub_key,
            nonce,
            amount_commitment,
            recipient_hash,
            lamports,
        )
    }

    // ---- Releases (unlock) ----
    // SPL tokens: amount explícito (puedes usar “todo” si tu handler lo decide)
    pub fn release_spl(ctx: Context<ReleaseSpl>, amount: u64) -> Result<()> {
        release_spl_handler(ctx, amount)
    }

    // SOL (WSOL → unwrap → SOL): normalmente drenas todo y cierras la vault
    pub fn release_sol(ctx: Context<ReleaseSol>, amount: u64) -> Result<()> {
        release_sol_handler(ctx, amount)
    }

    // ---- Config and Set (Init) ----

    pub fn init_config(
        ctx: Context<InitConfig>,
        fee_bps: u16,
        min_fee: u64,
        max_fee: u64,
        claim_window_secs: i64,
        min_solver_bond: u64,
        slash_bps: u16,
    ) -> Result<()> {
        init_config_handler(
            ctx,
            fee_bps,
            min_fee,
            max_fee,
            claim_window_secs,
            min_solver_bond,
            slash_bps,
        )
    }

    pub fn set_config(
        ctx: Context<SetConfig>,
        fee_bps: Option<u16>,
        min_fee: Option<u64>,
        max_fee: Option<u64>,
        claim_window_secs: Option<i64>,
        min_solver_bond: Option<u64>,
        slash_bps: Option<u16>,
    ) -> Result<()> {
        set_config_handler(
            ctx,
            fee_bps,
            min_fee,
            max_fee,
            claim_window_secs,
            min_solver_bond,
            slash_bps,
        )
    }
}
