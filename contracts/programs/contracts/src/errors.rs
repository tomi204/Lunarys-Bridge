use anchor_lang::prelude::*;

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
    #[msg("Only owner can modify config")]
    OnlyOwner,
    #[msg("Request already finalized")]
    RequestAlreadyFinalized,
    #[msg("Request currently has an active claim that is not expired yet")]
    ActiveClaimNotExpired,
    #[msg("Bond must be greater than zero")]
    ZeroBondNotAllowed,
    #[msg("Bond is too low")]
    BondTooLow,
    #[msg("Active claim already exists")]
    ActiveClaim,
    #[msg("No claim exists")]
    NoClaim,
    #[msg("Claim has expired")]
    ClaimExpired,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Already finalized")]
    AlreadyFinalized,
}
