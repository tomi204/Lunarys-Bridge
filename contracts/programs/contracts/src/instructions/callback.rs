use crate::constants::COMP_DEF_OFFSET_PLAN_PAYOUT;
use crate::errors::ErrorCode;
use crate::events::AttestationQueued;

use crate::ID_CONST;
use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

#[callback_accounts("plan_payout")]
#[derive(Accounts)]
pub struct PlanPayoutCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,

    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_PLAN_PAYOUT))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: validated by constraint
    pub instructions_sysvar: AccountInfo<'info>,
}

pub fn handler(
    _ctx: Context<PlanPayoutCallback>,
    output: ComputationOutputs<PlanPayoutOutput>,
) -> Result<()> {
    // The output wrapper from the MXE comes as { field_0 }
    let o = match output {
        ComputationOutputs::Success(PlanPayoutOutput { field_0 }) => field_0,
        _ => return Err(ErrorCode::AbortedComputation.into()),
    };

    emit!(AttestationQueued {
        nonce: o.nonce.to_le_bytes()
    });
    Ok(())
}
