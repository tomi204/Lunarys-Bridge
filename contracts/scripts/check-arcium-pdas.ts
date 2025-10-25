// scripts/check-arcium-pdas.ts
import { PublicKey } from "@solana/web3.js";
import {
  getMXEAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getClusterAccAddress,          // <-- espera number (offset)
  getMempoolAccAddress,
  getExecutingPoolAccAddress,    // nombre correcto
} from "@arcium-hq/client";
import "dotenv/config";
const PROGRAM_ID = new PublicKey("8gk2T4FJYaPUWHDzm5aKccu8HJSpEXYu3rFAoeb7FDE7");

// Si el paquete no expone helpers de fee/clock, toma del .env
const ENV_FEE_POOL = process.env.NEXT_PUBLIC_ARCIUM_POOL!;
const ENV_CLOCK    = process.env.NEXT_PUBLIC_ARCIUM_CLOCK!;

// Devnet cluster offset (o ponlo en .env: ARCIUM_CLUSTER_OFFSET)
const CLUSTER_OFFSET = Number(process.env.ARCIUM_CLUSTER_OFFSET ?? "1078779259");

(async () => {
  const mxe      = getMXEAccAddress(PROGRAM_ID);
  const cluster  = getClusterAccAddress(CLUSTER_OFFSET); // <-- aquí va el number
  const mempool  = getMempoolAccAddress(PROGRAM_ID);
  const execpool = getExecutingPoolAccAddress(PROGRAM_ID);

  const planOffset    = Buffer.from(getCompDefAccOffset("plan_payout")).readUInt32LE(0);
  const resealOffset  = Buffer.from(getCompDefAccOffset("reseal_destination")).readUInt32LE(0);
  const planCompDef   = getCompDefAccAddress(PROGRAM_ID, planOffset);
  const resealCompDef = getCompDefAccAddress(PROGRAM_ID, resealOffset);

  console.table({
    mxe: mxe.toBase58(),
    cluster: cluster.toBase58(),
    mempool: mempool.toBase58(),
    execpool: execpool.toBase58(),
    planCompDef: planCompDef.toBase58(),
    planOffset,
    resealCompDef: resealCompDef.toBase58(),
    resealOffset,
    feePool_env: ENV_FEE_POOL,
    clock_env: ENV_CLOCK,
  });
})();