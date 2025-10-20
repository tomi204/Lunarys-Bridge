// src/lib/evm-error.ts
// Selector-first EVM error decoder for Ethers v6.
// - Works with ethers/viem/provider error shapes
// - Decodes Error(string) + Panic(uint256)
// - Identifies custom errors by 4-byte selector (id(signature))
// - Optionally decodes args if signature (with types) is known

import { AbiCoder, id, toBeHex } from "ethers";

// Standard selectors
const REVERT_SELECTOR = "0x08c379a0"; // Error(string)
const PANIC_SELECTOR  = "0x4e487b71"; // Panic(uint256)

// Solidity panic codes (subset)
const PANIC_MAP: Record<string, string> = {
  "0x01": "assert(false) / unreachable",
  "0x11": "arithmetic overflow/underflow",
  "0x12": "divide by zero",
  "0x21": "invalid enum value",
  "0x22": "out-of-bounds / negative index",
  "0x31": "pop on empty array",
  "0x32": "array out-of-bounds",
  "0x41": "memory overflow",
  "0x51": "invalid internal function call",
};

export type DecodedEvmError = {
  kind: "custom" | "revert" | "panic" | "unknown";
  selector?: string;        // 0xNNNNNNNN
  signature?: string;       // e.g. "ERC20InsufficientBalance(address,uint256,uint256)"
  name?: string;            // e.g. "ERC20InsufficientBalance"
  argTypes?: string[];      // e.g. ["address","uint256","uint256"]
  args?: unknown[];         // decoded args if possible
  reason?: string;          // revert(string)
  panicCodeHex?: string;    // e.g. 0x11
  readable: string;         // final, human-friendly baseline
  rawData?: string;         // original revert data
};

// ------------------------- utils -------------------------

/** Extract revert data from common error shapes (ethers/viem/providers). */
<<<<<<< HEAD
function extractData(err: any): string | null {
  const candidates = [
    err?.data,
    err?.error?.data,
    err?.info?.error?.data,
    err?.cause?.data,
    err?.cause?.error?.data,
    // Some providers embed JSON in `body`
    (() => {
      if (typeof err?.body === "string") {
        try {
          const parsed = JSON.parse(err.body);
=======
function extractData(err: unknown): string | null {
  const e = err as Record<string, unknown>;
  const candidates = [
    e?.data,
    (e?.error as Record<string, unknown>)?.data,
    ((e?.info as Record<string, unknown>)?.error as Record<string, unknown>)?.data,
    (e?.cause as Record<string, unknown>)?.data,
    ((e?.cause as Record<string, unknown>)?.error as Record<string, unknown>)?.data,
    // Some providers embed JSON in `body`
    (() => {
      if (typeof e?.body === "string") {
        try {
          const parsed = JSON.parse(e.body);
>>>>>>> a8819ff626f422eaae904706dfe5fe3b497b9bfb
          return parsed?.error?.data;
        } catch { /* ignore */ }
      }
      return null;
    })(),
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("0x")) return c;
  }
  return null;
}

function normalize0xLower(x?: string | null) {
  return typeof x === "string" && x.startsWith("0x") ? x.toLowerCase() : x ?? null;
}

/** Compute 4-byte selector for a signature like "OnlyRelayer()". */
function selectorOf(signature: string): string {
  return id(signature).slice(0, 10).toLowerCase();
}

/** Build a selector → signature map once. */
export function buildSelectorMap(signatures: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const sig of signatures) map[selectorOf(sig)] = sig;
  return map;
}

/** Split parameter types from a signature, handling nested tuples. */
function parseArgTypes(signature: string): string[] {
  const start = signature.indexOf("(");
  const end = signature.lastIndexOf(")");
  if (start < 0 || end < 0 || end <= start) return [];
  const inside = signature.slice(start + 1, end).trim();
  if (!inside) return [];

  const types: string[] = [];
  let depth = 0;
  let cur = "";

  for (const ch of inside) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      types.push(cur.trim());
      cur = "";
    } else {
      if (ch !== "," || depth !== 0) cur += ch;
    }
  }
  if (cur.trim()) types.push(cur.trim());
  return types;
}

// ------------------------- standard decoders -------------------------

function tryRevertString(data: string): DecodedEvmError | null {
  data = data.toLowerCase();
  if (!data.startsWith(REVERT_SELECTOR)) return null;
  const [reason] = new AbiCoder().decode(["string"], "0x" + data.slice(10));
  const r = String(reason ?? "");
  return {
    kind: "revert",
    selector: REVERT_SELECTOR,
    reason: r,
    readable: r || "Revert(string)",
    rawData: data,
  };
}

function tryPanic(data: string): DecodedEvmError | null {
  data = data.toLowerCase();
  if (!data.startsWith(PANIC_SELECTOR)) return null;
  const [code] = new AbiCoder().decode(["uint256"], "0x" + data.slice(10));
  const hex = toBeHex(code);
  return {
    kind: "panic",
    selector: PANIC_SELECTOR,
    panicCodeHex: hex,
    readable: `Panic(${hex}) — ${PANIC_MAP[hex] ?? "unknown panic"}`,
    rawData: data,
  };
}

// ------------------------- signatures (mergeables) -------------------------

/** Custom errors del contrato NewRelayer (los que pegaste). */
export const NEW_RELAYER_ERROR_SIGS = [
  "OnlyRelayer()",
  "NotAuthorizedNode()",
  "ZeroAddress()",
  "ZeroAmount()",
  "InvalidFee()",
  "RequestAlreadyFinalized()",
  "RequestNotFound()",
  "ActiveClaim()",
  "NotSolver()",
  "ClaimExpired()",
  "NoClaim()",
  "BondTooLow()",
];

/** OpenZeppelin (ERC20 + Address utils + SafeERC20) — v5 style. */
export const OZ_ERROR_SIGS = [
  "ERC20InsufficientAllowance(address,uint256,uint256)",
  "ERC20InsufficientBalance(address,uint256,uint256)",
  "ERC20InvalidSender(address)",
  "ERC20InvalidReceiver(address)",
  "ERC20InvalidApprover(address)",
  "ERC20InvalidSpender(address)",
  "SafeTransferFailed()",
  "AddressInsufficientBalance(address)",
  "AddressEmptyCode(address)",
  "FailedInnerCall()",
];

/** Algunos errores comunes que mostraste del stack FHE. Amplialos si tenés más. */
export const FHE_ERROR_SIGS = [
  "InputLengthAbove64Bytes(uint256)",
  "InputLengthAbove128Bytes(uint256)",
  "InputLengthAbove256Bytes(uint256)",
  "HandlesAlreadySavedForRequestID()",
  "NoHandleFoundForRequestID()",
  "InvalidKMSSignatures()",
  "UnsupportedHandleType()",
  // Agregá más si tu lib los define, por ejemplo:
  // "InvalidProof()", "InvalidHandle()", "InvalidCiphertext()", "PermissionDenied(address)",
];

// Default map (podés construir uno custom con buildSelectorMap([...]) y pasarlo al decoder)
export const DEFAULT_SELECTOR_MAP: Record<string, string> = {
  ...buildSelectorMap(NEW_RELAYER_ERROR_SIGS),
  ...buildSelectorMap(OZ_ERROR_SIGS),
  ...buildSelectorMap(FHE_ERROR_SIGS),
};

// ------------------------- core decoder -------------------------

/**
 * Decodes an error by selector.
 * - Prioriza revert(string) y Panic(uint256).
 * - Si es custom: usa selectorMap para identificar el nombre; si la firma incluye tipos, decodifica args.
 */
export function decodeBySelector(
<<<<<<< HEAD
  err: any,
=======
  err: unknown,
>>>>>>> a8819ff626f422eaae904706dfe5fe3b497b9bfb
  selectorMap: Record<string, string> = DEFAULT_SELECTOR_MAP
): DecodedEvmError | null {
  const data0 = extractData(err);
  const data = normalize0xLower(data0);
  if (!data) {
<<<<<<< HEAD
    const msg = err?.shortMessage || err?.message;
=======
    const msg = (err as { shortMessage?: string; message?: string })?.shortMessage || (err as { message?: string })?.message;
>>>>>>> a8819ff626f422eaae904706dfe5fe3b497b9bfb
    return msg ? { kind: "unknown", readable: msg } : null;
  }

  // Standard decoders first
  const r = tryRevertString(data);
  if (r) return r;
  const p = tryPanic(data);
  if (p) return p;

  // Custom error by 4-byte selector
  const sel = data.slice(0, 10);
  const signature = selectorMap[sel];

  if (signature) {
    const name = signature.slice(0, signature.indexOf("("));
    const argTypes = parseArgTypes(signature);
    let args: unknown[] | undefined = undefined;

    if (argTypes.length > 0) {
      try {
        args = new AbiCoder().decode(argTypes, "0x" + data.slice(10)) as unknown[];
      } catch {
        // Si falla la decodificación (tipos no calzan), igual devolvemos el nombre.
      }
    }

    return {
      kind: "custom",
      selector: sel,
      signature,
      name,
      argTypes,
      args,
      readable: name,
      rawData: data,
    };
  }

  // Unknown selector (pero con data válida)
  return {
    kind: "unknown",
    selector: sel,
    readable: `Revert ${sel}`,
    rawData: data,
  };
}

/** Igual que arriba pero de un revert-data ya extraído (útil en tooling). */
export function decodeFromData(
  data: `0x${string}`,
  selectorMap: Record<string, string> = DEFAULT_SELECTOR_MAP
): DecodedEvmError | null {
  return decodeBySelector({ data }, selectorMap);
}

// ------------------------- pretty messages -------------------------

/** Human-friendly messages para tu bridge/UI. */
export function prettyBridgeError(d: DecodedEvmError | null): string {
  if (!d) return "Transacción revertida";

  // 1) revert(string)
  if (d.kind === "revert" && d.reason) return d.reason;

  // 2) panic
  if (d.kind === "panic") return d.readable;

  // 3) custom con mensajes específicos
  switch (d.name) {
    // NewRelayer
    case "OnlyRelayer":             return "Solo el relayer puede ejecutar esta acción.";
    case "NotAuthorizedNode":       return "Nodo no autorizado para reclamar.";
    case "ZeroAddress":             return "Dirección cero no permitida.";
    case "ZeroAmount":              return "La cantidad debe ser mayor que cero.";
    case "InvalidFee":              return "Fee inválida (fuera de límites configurados).";
    case "RequestAlreadyFinalized": return "La solicitud ya fue finalizada.";
    case "RequestNotFound":         return "Solicitud de bridge no encontrada.";
    case "ActiveClaim":             return "La solicitud tiene un claim activo.";
    case "NotSolver":               return "Solo el solver actual puede operar.";
    case "ClaimExpired":            return "El claim expiró.";
    case "NoClaim":                 return "La solicitud no tiene claim.";
    case "BondTooLow":              return "Bond en ETH insuficiente.";

    // OpenZeppelin ERC20
    case "ERC20InsufficientBalance": {
      const [from, balance, needed] = (d.args ?? []) as [string, bigint, bigint];
      if (from && balance !== undefined && needed !== undefined) {
        return `Saldo insuficiente: ${from} tiene ${balance.toString()} y se requieren ${needed.toString()} (en unidades del token).`;
      }
      return "Saldo insuficiente para transferir.";
    }
    case "ERC20InsufficientAllowance": {
      const [spender, current, needed] = (d.args ?? []) as [string, bigint, bigint];
      if (spender && current !== undefined && needed !== undefined) {
        return `Allowance insuficiente para ${spender}: actual ${current.toString()}, requerido ${needed.toString()} (en unidades del token).`;
      }
      return "Allowance insuficiente.";
    }
    case "ERC20InvalidSender":      return "Remitente ERC20 inválido.";
    case "ERC20InvalidReceiver":    return "Receptor ERC20 inválido.";
    case "ERC20InvalidApprover":    return "Aprobador ERC20 inválido.";
    case "ERC20InvalidSpender":     return "Spender ERC20 inválido.";
    case "SafeTransferFailed":      return "Falló el safeTransfer (token no cumple ERC20 o revertió).";
    case "AddressEmptyCode":        return "La dirección de destino no tiene código (no es contrato).";
    case "AddressInsufficientBalance": return "La dirección no tiene balance suficiente para la llamada.";
    case "FailedInnerCall":         return "Falló una llamada interna (low-level call).";

    // FHE samples
    case "InputLengthAbove64Bytes":    return "Input demasiado grande (> 64 bytes).";
    case "InputLengthAbove128Bytes":   return "Input demasiado grande (> 128 bytes).";
    case "InputLengthAbove256Bytes":   return "Input demasiado grande (> 256 bytes).";
    case "HandlesAlreadySavedForRequestID": return "Ya existen handles guardados para ese request.";
    case "NoHandleFoundForRequestID":  return "No se encontró handle para el request.";
    case "InvalidKMSSignatures":       return "Firmas KMS inválidas.";
    case "UnsupportedHandleType":      return "Tipo de handle no soportado.";
  }

  // 4) fallback
  return d.readable;
}

// ------------------------- helpers to extend -------------------------

/** Crea un selectorMap nuevo mergeando tus propias firmas. */
export function makeSelectorMap(...signatureGroups: string[][]): Record<string, string> {
  return signatureGroups.reduce<Record<string, string>>((acc, group) => {
    Object.assign(acc, buildSelectorMap(group));
    return acc;
  }, {});
}

