use crate::ID;
use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

// This macro implements InitCompDefAccs for the struct
#[init_computation_definition_accounts("plan_payout", payer)]
#[derive(Accounts)]
pub struct InitPlanPayoutCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    // PDA del MXE (ya existente, por eso address = derive_mxe_pda!())
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,

    // The comp_def does not exist yet: DO NOT put address constraint here.
    #[account(mut)]
    /// CHECK: validated by constraint in init_comp_def
    pub comp_def_account: UncheckedAccount<'info>,

    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitPlanPayoutCompDef>) -> Result<()> {
    // (allow_untrusted_senders = true, compute_units = 0, fees = None, expiry = None)
    init_comp_def(ctx.accounts, true, 0, None, None)?;
    Ok(())
}
