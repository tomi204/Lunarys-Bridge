# FHEVMjs Issue en Node.js con ESM

## Problema

El paquete `fhevmjs@0.6.2` tiene un problema con los exports cuando se usa en Node.js con módulos ESM (`"type": "module"`):

```json
"exports": {
  ".": {
    "import": "./lib/web.js",  // ← Usa versión browser
    "require": "./lib/node.cjs" // ← Versión Node.js solo con require
  },
  "./node": {
    "require": "./lib/node.cjs" // ← No hay export para "import"
  }
}
```

## Error Actual

```
TypeError: invalid EIP-1193 provider (argument="ethereum", value="https://...", ...)
at new BrowserProvider
```

Esto ocurre porque cuando hacemos `import { createInstance } from "fhevmjs"`, se usa `web.js` que intenta crear un `BrowserProvider` (solo funciona en navegador).

## Soluciones Posibles

### Opción 1: Usar CommonJS (require)

Cambiar a `"type": "commonjs"` en `package.json`, pero esto rompe las importaciones de `@solana/spl-token`.

### Opción 2: Usar dynamic import con require (Temporal) ✅

```typescript
// En vez de:
import { createInstance } from "fhevmjs";

// Usar:
const fhevmjs = await import("fhevmjs");
// O intentar requerir directamente el .cjs
```

### Opción 3: Usar un hardcoded destination para testing

Mientras se soluciona el issue de fhevmjs, puedes:

1. Comentar la inicialización de FHE
2. Usar una dirección hardcoded para testing
3. El nodo ya detecta USDC correctamente y envía el SPL token

## Implementación Actual

El nodo **YA tiene implementado**:

- ✅ Detección de tipo de token (ETH nativo vs ERC20)
- ✅ Mapeo automático USDC Sepolia → USDC Solana Devnet
- ✅ Conversión de decimales (si es necesario)
- ✅ Transferencia de SPL tokens

**Lo único que falta es la desencriptación FHE**, que requiere:

1. Contactar a Zama para una versión actualizada de fhevmjs con soporte ESM
2. O usar una solución temporal con destination hardcoded

## Testing Actual

Para probar el nodo sin FHE:

```typescript
// En src/index.ts, línea ~142, reemplazar:
const solanaDestination = await this.fheDecryptor.decryptSolanaAddress(
  request.requestId,
  this.config.newRelayerAddress
);

// Con:
const solanaDestination = "TU_DIRECCION_SOLANA_DE_PRUEBA";
console.log(`Using hardcoded destination for testing: ${solanaDestination}`);
```

El resto del flujo funciona perfectamente.
