#![allow(unexpected_cfgs)]
#![allow(deprecated)]

use anchor_lang::prelude::*;
use anchor_spl::token::{self as token, Mint, Token, TokenAccount, TransferChecked};
use arcium_anchor::prelude::*;

pub const COMP_DEF_OFFSET_PLAN_PAYOUT: u32 = comp_def_offset("plan_payout");

declare_id!("CoCnSp3ooSWqVaaaKiw9WS3fEZ1yXzasta28SfPaUmxD");

#[arcium_program]
pub mod new_contracts {
    use super::*;

    // 1 => Init computation definition ( plan_payout )
    pub fn init_plan_payout_comp_def(ctx: Context<InitPlanPayoutCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    // 2 = Queue confidential computation (no SPL lock)
    pub fn queue_plan_payout(
        ctx: Context<QueuePlanPayout>,
        computation_offset: u64,
        pub_key: [u8; 32],
        nonce: u128,
        amount_ct: [u8; 32],        // EncryptedU64(amount)
        recipient_tag_ct: [u8; 32], // EncryptedU64(recipient_tag)
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
            vec![PlanPayoutCallback::callback_ix(&[])],
        )?;
        Ok(())
    }

    // 3 = Deposit SPL + Queue confidential computation
    pub fn deposit_and_queue(
        ctx: Context<DepositAndQueue>,
        computation_offset: u64,

        // For the MXE demo, we use two encrypted amounts: amount and recipient_tag
        amount_ct: [u8; 32],
        recipient_tag_ct: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,

        // Public metadata (optional)
        amount_commitment: [u8; 32],
        recipient_hash: [u8; 32],

        // Visible amount (MVP without Confidential Transfers)
        amount: u64,
    ) -> Result<()> {
        // 1 = Lock SPL in escrow
        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.user_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.escrow_token.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        // 2 Minimum public event (no sensitive data)
        emit!(BridgeDeposit {
            // Can use either computation_account or escrow_token for the id
            deposit_id: ctx.accounts.computation_account.key().to_bytes(),
            amount_commitment,
            recipient_hash,
            nonce,
            ts: Clock::get()?.unix_timestamp as u64,
        });

        // 3 = Queue confidential computation (no SPL lock)
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
            vec![PlanPayoutCallback::callback_ix(&[])],
        )?;
        Ok(())
    }

    // 4 => Callback from MXE → emits minimal attestation
    #[arcium_callback(encrypted_ix = "plan_payout")]
    pub fn plan_payout_callback(
        ctx: Context<PlanPayoutCallback>,
        output: ComputationOutputs<PlanPayoutOutput>,
    ) -> Result<()> {
        let _ = &ctx;
        let o = match output {
            ComputationOutputs::Success(PlanPayoutOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(AttestationQueued {
            nonce: o.nonce.to_le_bytes()
        });
        Ok(())
    }
}

// ====== Accounts ======

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

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(mut, address = derive_mempool_pda!())]
    /// CHECK:
    pub mempool_account: UncheckedAccount<'info>,

    #[account(mut, address = derive_execpool_pda!())]
    /// CHECK:
    pub executing_pool: UncheckedAccount<'info>,

    #[account(mut, address = derive_comp_pda!(computation_offset))]
    /// CHECK:
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

#[queue_computation_accounts("plan_payout", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct DepositAndQueue<'info> {
    // --- Signer/payer ---
    #[account(mut)]
    pub payer: Signer<'info>,

    // --- SPL (classic lock: USDC/USDT) ---
    /// User account that sends tokens (ATA or not). Must be authority = payer.
    #[account(
        mut,
        constraint = user_token.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = user_token.owner == payer.key() @ ErrorCode::InvalidOwner
    )]
    pub user_token: Account<'info, TokenAccount>,

    /// Mint of the token (USDC/USDT/etc.)
    pub mint: Account<'info, Mint>,

    /// Escrow account that receives the lock (your PDA or program account).
    #[account(
        mut,
        constraint = escrow_token.mint == mint.key() @ ErrorCode::InvalidMint
    )]
    pub escrow_token: Account<'info, TokenAccount>,

    /// SPL program
    pub token_program: Program<'info, Token>,

    // --- Arcium  ---
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(mut, address = derive_mempool_pda!())]
    /// CHECK: validated by the Arcium program
    pub mempool_account: UncheckedAccount<'info>,

    #[account(mut, address = derive_execpool_pda!())]
    /// CHECK: validated by the Arcium program
    pub executing_pool: UncheckedAccount<'info>,

    #[account(mut, address = derive_comp_pda!(computation_offset))]
    /// CHECK: validated by the Arcium program
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

#[callback_accounts("plan_payout")]
#[derive(Accounts)]
pub struct PlanPayoutCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_PLAN_PAYOUT))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK:
    pub instructions_sysvar: AccountInfo<'info>,
}

#[init_computation_definition_accounts("plan_payout", payer)]
#[derive(Accounts)]
pub struct InitPlanPayoutCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK:
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

// ====== Events & Errors ======

#[event]
pub struct BridgeDeposit {
    pub deposit_id: [u8; 32],        // MVP: key del comp_account o del escrow
    pub amount_commitment: [u8; 32], // optional: [0; 32] if not used yet
    pub recipient_hash: [u8; 32],    // optional: [0; 32] if not used yet
    pub nonce: u128,                 // correlation nonce
    pub ts: u64,                     // timestamp on-chain
}

#[event]
pub struct AttestationQueued {
    pub nonce: [u8; 16],
}

#[error_code]
pub enum ErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
    #[msg("Invalid token mint")]
    InvalidMint,
    #[msg("Invalid token owner")]
    InvalidOwner,
}
