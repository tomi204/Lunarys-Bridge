use crate::constants::CIRCUIT_URL_PLAN_PAYOUT;
use crate::ID;
use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::{CircuitSource, OffChainCircuitSource};

#[init_computation_definition_accounts("plan_payout", payer)]
#[derive(Accounts)]
pub struct InitPlanPayoutCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: validado por init_comp_def
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitPlanPayoutCompDef>) -> Result<()> {
    init_comp_def(
        ctx.accounts,
        true,
        0,
        Some(CircuitSource::OffChain(OffChainCircuitSource {
            source: CIRCUIT_URL_PLAN_PAYOUT.to_string(),
            hash: [0u8; 32],
        })),
        None,
    )?;
    Ok(())
}
