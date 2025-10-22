use arcis_imports::*;

/// Everything you compile here generates `.arcis` files in `build/`
/// and the function names must **match** the ones you use
/// in `comp_def_offset("...")` in the on-chain program.

#[encrypted]
mod circuits {
    use arcis_imports::*;

    /// Destination words for payouts
    pub struct DestWords {
        w0: u64,
        w1: u64,
        w2: u64,
        w3: u64,
    }

    /// 1) plan_payout: passthrough encrypted instruction
    #[instruction]
    pub fn plan_payout(input_ctxt: Enc<Shared, DestWords>) -> Enc<Shared, (u64, u64, u64, u64)> {
        let d = input_ctxt.to_arcis();
        input_ctxt.owner.from_arcis((d.w0, d.w1, d.w2, d.w3))
    }

    /// 2) reseal_destination: passthrough for “reseal” in claim
    #[instruction]
    pub fn reseal_destination(
        input_ctxt: Enc<Shared, DestWords>,
    ) -> Enc<Shared, (u64, u64, u64, u64)> {
        let d = input_ctxt.to_arcis();
        // Currently this is identical to plan_payout (could be combined)
        // If we ever need different logic, we can change it here.
        input_ctxt.owner.from_arcis((d.w0, d.w1, d.w2, d.w3))
    }
}
