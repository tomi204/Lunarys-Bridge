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

// ===== Tracing helpers (opcionales; se activan con --features trace) =====
#[cfg(feature = "trace")]
#[macro_export]
macro_rules! trace {
    ($($arg:tt)*) => {{
        ::anchor_lang::prelude::msg!($($arg)*);
    }};
}
#[cfg(not(feature = "trace"))]
#[macro_export]
macro_rules! trace {
    ($($arg:tt)*) => {};
}

#[cfg(feature = "trace")]
#[inline(always)]
pub fn cu(label: &str) {
    ::anchor_lang::prelude::msg!(label);
    ::anchor_lang::solana_program::log::sol_log_compute_units();
}
#[cfg(not(feature = "trace"))]
#[inline(always)]
pub fn cu(_label: &str) {}

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

declare_id!("8gk2T4FJYaPUWHDzm5aKccu8HJSpEXYu3rFAoeb7FDE7");

#[arcium_program]
pub mod contracts {
    use super::*;

    // ---- Arcium: comp-def init / queue / callback ----
    pub fn init_plan_payout_comp_def(ctx: Context<InitPlanPayoutCompDef>) -> Result<()> {
        trace!("entry:init_plan_payout_comp_def");
        cu("before:init_plan_payout_comp_def");
        let res = init_plan_payout_comp_def_handler(ctx);
        cu("after:init_plan_payout_comp_def");
        res
    }

    pub fn init_reseal_comp_def(ctx: Context<InitResealCompDef>) -> Result<()> {
        trace!("entry:init_reseal_comp_def");
        cu("before:init_reseal_comp_def");
        let res = init_reseal_comp_def_handler(ctx);
        cu("after:init_reseal_comp_def");
        res
    }

    pub fn queue_plan_payout(
        ctx: Context<QueuePlanPayout>,
        computation_offset: u64,
        pub_key: [u8; 32],
        nonce: u128,
        amount_ct: [u8; 32],
        recipient_tag_ct: [u8; 32],
    ) -> Result<()> {
        trace!("entry:queue_plan_payout off={}", computation_offset);
        cu("before:queue_plan_payout");
        let res = queue_plan_payout_handler(
            ctx,
            computation_offset,
            pub_key,
            nonce,
            amount_ct,
            recipient_tag_ct,
        );
        cu("after:queue_plan_payout");
        res
    }

    #[arcium_callback(encrypted_ix = "plan_payout")]
    pub fn plan_payout_callback(
        ctx: Context<PlanPayoutCallback>,
        output: ComputationOutputs<PlanPayoutOutput>,
    ) -> Result<()> {
        trace!("entry:plan_payout_callback");
        cu("before:plan_payout_callback");
        let res = plan_payout_callback_handler(ctx, output);
        cu("after:plan_payout_callback");
        res
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
        trace!("entry:initiate_bridge req_id={}", request_id);
        cu("before:initiate_bridge");
        let res = deposit_and_queue_handler(
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
        );
        cu("after:initiate_bridge");
        res
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
        trace!("entry:initiate_bridge_sol req_id={}", request_id);
        cu("before:initiate_bridge_sol");
        let res = deposit_sol_and_queue_handler(
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
        );
        cu("after:initiate_bridge_sol");
        res
    }

    // ---- Releases (unlock) ----
    pub fn deliver_tokens(ctx: Context<ReleaseSpl>, amount: u64) -> Result<()> {
        trace!("entry:deliver_tokens amount={}", amount);
        cu("before:deliver_tokens");
        let res = release_spl_handler(ctx, amount);
        cu("after:deliver_tokens");
        res
    }

    pub fn deliver_tokens_sol(ctx: Context<ReleaseSol>, amount: u64) -> Result<()> {
        trace!("entry:deliver_tokens_sol amount={}", amount);
        cu("before:deliver_tokens_sol");
        let res = release_sol_handler(ctx, amount);
        cu("after:deliver_tokens_sol");
        res
    }

    // ---- Config ----
    pub fn init_config(
        ctx: Context<InitConfig>,
        fee_bps: u16,
        min_fee: u64,
        max_fee: u64,
        claim_window_secs: i64,
        min_solver_bond: u64,
        slash_bps: u16,
    ) -> Result<()> {
        trace!("entry:init_config");
        cu("before:init_config");
        let res = init_config_handler(
            ctx,
            fee_bps,
            min_fee,
            max_fee,
            claim_window_secs,
            min_solver_bond,
            slash_bps,
        );
        cu("after:init_config");
        res
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
        trace!("entry:set_config");
        cu("before:set_config");
        let res = set_config_handler(
            ctx,
            fee_bps,
            min_fee,
            max_fee,
            claim_window_secs,
            min_solver_bond,
            slash_bps,
        );
        cu("after:set_config");
        res
    }

    // ---- Claim / settle / expirations ----
    pub fn claim_bridge(
        ctx: Context<ClaimRequest>,
        computation_offset_reseal: u64,
        request_id: u64,
        solver_x25519: [u8; 32],
    ) -> Result<()> {
        trace!("entry:claim_bridge req_id={}", request_id);
        cu("before:claim_bridge");
        let res = claim_request_handler(ctx, computation_offset_reseal, request_id, solver_x25519);
        cu("after:claim_bridge");
        res
    }

    pub fn release_expired_claim(ctx: Context<ReleaseExpiredClaim>, request_id: u64) -> Result<()> {
        trace!("entry:release_expired_claim req_id={}", request_id);
        cu("before:release_expired_claim");
        let res = release_expired_claim_handler(ctx, request_id);
        cu("after:release_expired_claim");
        res
    }

    pub fn verify_and_settle_spl(
        ctx: Context<VerifyAndSettleSpl>,
        request_id: u64,
        dest_tx_hash: [u8; 32],
        evidence_hash: [u8; 32],
        evidence_url: String,
    ) -> Result<()> {
        trace!("entry:verify_and_settle_spl req_id={}", request_id);
        cu("before:verify_and_settle_spl");
        let res = verify_and_settle_spl_handler(
            ctx,
            request_id,
            dest_tx_hash,
            evidence_hash,
            evidence_url,
        );
        cu("after:verify_and_settle_spl");
        res
    }
}
