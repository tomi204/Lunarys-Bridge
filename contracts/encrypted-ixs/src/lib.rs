use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    // Entry of the bridge (the way to call the MPC logic)
    pub struct BridgeInputs {
        amount: u64,
        recipient_tag: u64,
    }

    // The output is u64 (e.g., an attestation/score/flag)
    #[instruction]
    pub fn plan_payout(input_ctxt: Enc<Shared, BridgeInputs>) -> Enc<Shared, u64> {
        let input = input_ctxt.to_arcis();

        // For demo: return "ok" (=1) if amount>0, else 0.
        let decision: u64 = if input.amount > 0 { 1 } else { 0 };

        input_ctxt.owner.from_arcis(decision)
    }
}
