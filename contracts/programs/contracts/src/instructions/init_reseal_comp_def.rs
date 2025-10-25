use crate::constants::CIRCUIT_URL_RESEAL;
use crate::{ID, ID_CONST};
use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::{CircuitSource, OffChainCircuitSource};

#[init_computation_definition_accounts("reseal_destination", payer)]
#[derive(Accounts)]
pub struct InitResealCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    // sin Box: el macro espera Account<'info, MXEAccount>
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    // La crea/actualiza el CPI; no necesitamos deserializar
    #[account(mut)]
    /// CHECK: validado por el CPI de init_comp_def
    pub comp_def_account: UncheckedAccount<'info>,

    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitResealCompDef>) -> Result<()> {
    init_comp_def(
        ctx.accounts,
        true, // público
        0,    // versión
        Some(CircuitSource::OffChain(OffChainCircuitSource {
            source: CIRCUIT_URL_RESEAL.to_string(),
            hash: [0u8; 32], // si aún no fijas hash
        })),
        None,
    )?;
    Ok(())
}
