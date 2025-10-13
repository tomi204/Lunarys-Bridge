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
}
