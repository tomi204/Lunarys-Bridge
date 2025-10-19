use arcis_imports::*;

/// Todo lo que compiles aquí genera `.arcis` en build/
/// y los nombres de función deben **coincidir** con los que usas
/// en `comp_def_offset("...")` en el programa on-chain.

#[encrypted]
mod circuits {
    use arcis_imports::*;

    /// Destino de Solana como 4 palabras u64 (little-endian)
    pub struct DestWords {
        w0: u64,
        w1: u64,
        w2: u64,
        w3: u64,
    }

    /// 1) plan_payout: passthrough cifrado (lo usas en deposit_*)
    #[instruction]
    pub fn plan_payout(input_ctxt: Enc<Shared, DestWords>) -> Enc<Shared, (u64, u64, u64, u64)> {
        let d = input_ctxt.to_arcis();
        input_ctxt.owner.from_arcis((d.w0, d.w1, d.w2, d.w3))
    }

    /// 2) reseal_destination: passthrough para “reseal” en claim
    #[instruction]
    pub fn reseal_destination(
        input_ctxt: Enc<Shared, DestWords>,
    ) -> Enc<Shared, (u64, u64, u64, u64)> {
        let d = input_ctxt.to_arcis();
        // (hoy es igual al de arriba; más adelante puedes cambiar el "owner"
        // si quieres mover la propiedad criptográfica)
        input_ctxt.owner.from_arcis((d.w0, d.w1, d.w2, d.w3))
    }
}
