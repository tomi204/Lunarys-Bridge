use crate::ID;
use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::{CircuitSource, OffChainCircuitSource};


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
    init_comp_def(
        ctx.accounts,
        true, // allow_untrusted_senders
        0,    // CU
        Some(CircuitSource::OffChain(OffChainCircuitSource {
            source: "https://gateway.pinata.cloud/ipfs/bafybeias7etzkgaaqktjq4tkxb2ptxz4e3qhv5tjzwfk2luufy5pqv5fn4".to_string(),
            hash: [0u8; 32],
        })),
        None,
    )?;
    Ok(())
}
