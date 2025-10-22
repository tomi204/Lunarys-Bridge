// lib/bridge/solana/evm.ts
export const u64LE = (n: bigint) => {
  const out = new Uint8Array(8);
  let v = n;
  for (let i = 0; i < 8; i++) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return Buffer.from(out);
};

const bytesToBigBE = (b: Uint8Array) => {
  let v = 0n;
  for (const x of b) v = (v << 8n) + BigInt(x);
  return v;
};

export function ethAddressTo4U64(addr: string, endian: "be" | "le" = "be"): [bigint, bigint, bigint, bigint] {
  const h = addr.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(h)) throw new Error("Dirección EVM inválida (esperaba 20 bytes hex)");
  const raw = new Uint8Array(h.length / 2);
  for (let i = 0; i < raw.length; i++) raw[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);

  // Pack en 32 bytes (4×u64). Los 20 bytes van al final (big-endian por default).
  const buf32 = new Uint8Array(32);
  if (endian === "be") {
    buf32.set(raw, 32 - 20); // left-pad con ceros
  } else {
    buf32.set(raw, 0);       // variante le “rara”, por si tu programa lo pide
  }

  const parts: [bigint, bigint, bigint, bigint] = [0n, 0n, 0n, 0n];
  for (let i = 0; i < 4; i++) {
    const chunk = buf32.slice(i * 8, (i + 1) * 8); // 8 bytes
    parts[i] = bytesToBigBE(chunk);                // interpretamos cada u64 como BE
  }
  return parts;
}

export function encode4U64LE(parts: [bigint, bigint, bigint, bigint]): Buffer {
  return Buffer.concat([u64LE(parts[0]), u64LE(parts[1]), u64LE(parts[2]), u64LE(parts[3])]);
}
