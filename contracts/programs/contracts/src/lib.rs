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
    claim_request_handler,
    // deposits
    deposit_and_queue_handler,
    deposit_sol_and_queue_handler,
    init_config_handler,
    // init / queue / callback
    init_plan_payout_comp_def_handler,
    init_request_handler,
    init_reseal_comp_def_handler,
    plan_payout_callback_handler,
    queue_plan_payout_handler,
    release_expired_claim_handler,
    release_sol_handler,
    // releases
    release_spl_handler,
    set_config_handler,
    verify_and_settle_spl_handler,
    ClaimRequest,
    // Context types
    DepositAndQueue,
    DepositSolAndQueue,
    InitConfig,
    InitPlanPayoutCompDef,
    InitRequest,
    InitResealCompDef,
    PlanPayoutCallback,
    QueuePlanPayout,
    ReleaseExpiredClaim,
    ReleaseSol,
    ReleaseSpl,
    SetConfig,
    VerifyAndSettleSpl,
};

// Aliases the #[arcium_program] macro expects at crate root
pub(crate) use instructions::callback::__client_accounts_plan_payout_callback;
pub(crate) use instructions::claim_bridge::__client_accounts_claim_request;
pub(crate) use instructions::config_init::__client_accounts_init_config;
pub(crate) use instructions::config_set::__client_accounts_set_config;
pub(crate) use instructions::deposit::__client_accounts_deposit_and_queue;
pub(crate) use instructions::deposit_sol::__client_accounts_deposit_sol_and_queue;
pub(crate) use instructions::init::__client_accounts_init_plan_payout_comp_def;
pub(crate) use instructions::init_reseal_comp_def::__client_accounts_init_reseal_comp_def;
pub(crate) use instructions::queue::__client_accounts_queue_plan_payout;
pub(crate) use instructions::release_expired_claim::__client_accounts_release_expired_claim;
pub(crate) use instructions::release_sol::__client_accounts_release_sol;
pub(crate) use instructions::release_spl::__client_accounts_release_spl;
pub(crate) use instructions::verify_and_settle::__client_accounts_verify_and_settle_spl;

declare_id!("FjmUtLwGQibY9ZU1vnGQo5wwBPvo2gNx2mX5rHu9n3Wb");
//declare_id!("AfaF8Qe6ZR9kiGhBzJjuyLp6gmBwc7gZBivGhHzxN1by");

#[arcium_program]
pub mod contracts {
    use super::*;

    // ---- Arcium: comp-def init / queue / callback ----
    pub fn init_plan_payout_comp_def(ctx: Context<InitPlanPayoutCompDef>) -> Result<()> {
        init_plan_payout_comp_def_handler(ctx)
    }
    pub fn init_reseal_comp_def(ctx: Context<InitResealCompDef>) -> Result<()> {
        init_reseal_comp_def_handler(ctx)
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
    pub fn initiate_bridge(
        ctx: Context<DepositAndQueue>,
        computation_offset: u64,
        request_id: u64,
        client_pubkey: [u8; 32],
        nonce: [u8; 16],
        destination_ct0: [u8; 32],
        destination_ct1: [u8; 32],
        destination_ct2: [u8; 32],
        destination_ct3: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        deposit_and_queue_handler(
            ctx,
            computation_offset,
            request_id,
            client_pubkey,
            nonce,
            destination_ct0,
            destination_ct1,
            destination_ct2,
            destination_ct3,
            amount,
        )
    }

    pub fn initiate_bridge_sol(
        ctx: Context<DepositSolAndQueue>,
        computation_offset: u64,
        request_id: u64,
        client_pubkey: [u8; 32],
        nonce: [u8; 16],
        destination_ct0: [u8; 32],
        destination_ct1: [u8; 32],
        destination_ct2: [u8; 32],
        destination_ct3: [u8; 32],
        lamports: u64,
    ) -> Result<()> {
        deposit_sol_and_queue_handler(
            ctx,
            computation_offset,
            request_id,
            client_pubkey,
            nonce,
            destination_ct0,
            destination_ct1,
            destination_ct2,
            destination_ct3,
            lamports,
        )
    }
    // ---- Releases (unlock) ----
    // SPL tokens: explicit amount (you can use “all” if your handler decides so)
    pub fn deliver_tokens(ctx: Context<ReleaseSpl>, amount: u64) -> Result<()> {
        release_spl_handler(ctx, amount)
    }

    // SOL (WSOL → unwrap → SOL): normally you drain everything and close the vault
    pub fn deliver_tokens_sol(ctx: Context<ReleaseSol>, amount: u64) -> Result<()> {
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
    pub fn claim_bridge(
        ctx: Context<ClaimRequest>,
        computation_offset_reseal: u64,
        request_id: u64,
        solver_x25519: [u8; 32],
    ) -> Result<()> {
        claim_request_handler(ctx, computation_offset_reseal, request_id, solver_x25519)
    }

    pub fn release_expired_claim(ctx: Context<ReleaseExpiredClaim>, request_id: u64) -> Result<()> {
        release_expired_claim_handler(ctx, request_id)
    }

    pub fn verify_and_settle_spl(
        ctx: Context<VerifyAndSettleSpl>,
        request_id: u64,
        dest_tx_hash: [u8; 32],
        evidence_hash: [u8; 32],
        evidence_url: String,
    ) -> Result<()> {
        verify_and_settle_spl_handler(ctx, request_id, dest_tx_hash, evidence_hash, evidence_url)
    }
}
