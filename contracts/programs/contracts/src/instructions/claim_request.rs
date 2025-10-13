#[derive(Accounts)]
#[instruction(request_id: u64)]
pub struct ClaimRequest<'info> {
    #[account(mut)]
    pub solver: Signer<'info>,

    #[account(seeds=[b"config"], bump = config.bump)]
    pub config: Account<'info, BridgeConfig>,

    #[account(
        mut,
        seeds = [b"request", request_owner.key().as_ref(), &request_id.to_le_bytes()],
        bump = request_pda.bump
    )]
    pub request_pda: Account<'info, BridgeRequest>,

    /// who originated the request (for seeds)
    /// CHECK: It is only used for seeds/validation (you can store payer in request to avoid passing it)
    pub request_owner: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
