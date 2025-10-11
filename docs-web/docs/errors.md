---
sidebar_label: "Error Codes"
---

# Error Codes and Handling

This document provides comprehensive information about error codes, their meanings, and how to handle them in LUNARYS applications.

## Smart Contract Errors

### Error Categories

Errors are categorized by their source and severity:

- **0x01-0x0F**: Input validation errors
- **0x10-0x1F**: Authorization errors
- **0x20-0x2F**: State errors
- **0x30-0x3F**: Computation errors
- **0x40-0x4F**: Cryptographic errors

### Detailed Error Codes

#### Input Validation Errors (0x01-0x0F)

##### ERROR_INVALID_AMOUNT (0x01)

**Description:** Transaction amount is invalid (zero or negative)

**Causes:**

- Amount parameter is 0
- Amount parameter is negative
- Amount exceeds maximum allowed value

**Handling:**

```typescript
try {
  await lunarys.createPayment({ amount: 0 });
} catch (error) {
  if (error.code === "ERROR_INVALID_AMOUNT") {
    // Prompt user to enter valid amount
    showError("Please enter an amount greater than 0");
  }
}
```

##### ERROR_INVALID_RECIPIENT (0x02)

**Description:** Recipient address is invalid

**Causes:**

- Invalid Solana public key format
- Recipient address is the zero address
- Recipient is the same as sender

**Handling:**

```typescript
if (!isValidPublicKey(recipient)) {
  throw new Error("Invalid recipient address");
}
```

##### ERROR_INVALID_COMMITMENT (0x03)

**Description:** Cryptographic commitment is invalid

**Causes:**

- Commitment doesn't match expected format
- Commitment verification fails
- Malformed commitment data

##### ERROR_INVALID_ENCRYPTION (0x04)

**Description:** Encrypted data is invalid

**Causes:**

- Ciphertext is malformed
- Decryption fails
- Invalid encryption key

#### Authorization Errors (0x10-0x1F)

##### ERROR_UNAUTHORIZED (0x10)

**Description:** Caller is not authorized for this operation

**Causes:**

- Wrong signer for transaction
- Insufficient permissions
- Account ownership mismatch

**Handling:**

```typescript
// Ensure correct signer
const tx = await program.methods
  .someInstruction()
  .accounts({
    authority: userPublicKey,
    // ... other accounts
  })
  .signers([userKeypair])
  .rpc();
```

##### ERROR_INSUFFICIENT_PERMISSIONS (0x11)

**Description:** Account has insufficient permissions

**Causes:**

- Missing required authority
- Role-based access control failure
- PDA derivation mismatch

#### State Errors (0x20-0x2F)

##### ERROR_INSUFFICIENT_BALANCE (0x20)

**Description:** Account has insufficient balance for transaction

**Causes:**

- Balance lower than transaction amount
- Token account has insufficient funds
- Locked or reserved funds

**Handling:**

```typescript
const balance = await connection.getTokenAccountBalance(userTokenAccount);
if (balance.value.uiAmount < amount) {
  throw new Error("Insufficient balance");
}
```

##### ERROR_ACCOUNT_NOT_FOUND (0x21)

**Description:** Required account not found

**Causes:**

- Account doesn't exist
- Wrong account address
- Account closed or frozen

##### ERROR_ACCOUNT_FROZEN (0x22)

**Description:** Account is frozen and cannot be modified

**Causes:**

- Token account freeze authority exercised
- Compliance freeze
- Administrative freeze

#### Computation Errors (0x30-0x3F)

##### ERROR_COMPUTATION_FAILED (0x30)

**Description:** Arcium computation failed

**Causes:**

- Invalid computation parameters
- Computation timeout
- Arcium service unavailable

**Handling:**

```typescript
// Implement retry logic with exponential backoff
let retries = 0;
const maxRetries = 3;

while (retries < maxRetries) {
  try {
    const result = await lunarys.queueComputation(params);
    break;
  } catch (error) {
    if (error.code === "ERROR_COMPUTATION_FAILED") {
      retries++;
      await sleep(Math.pow(2, retries) * 1000);
    } else {
      throw error;
    }
  }
}
```

##### ERROR_INVALID_PROOF (0x31)

**Description:** Zero-knowledge proof verification failed

**Causes:**

- Proof doesn't match public inputs
- Proof is malformed
- Verification key mismatch

##### ERROR_COMPUTATION_TIMEOUT (0x32)

**Description:** Computation request timed out

**Causes:**

- Arcium network congestion
- Computation too complex
- Service degradation

#### Cryptographic Errors (0x40-0x4F)

##### ERROR_DECRYPTION_FAILED (0x40)

**Description:** Data decryption failed

**Causes:**

- Wrong decryption key
- Corrupted ciphertext
- Invalid encryption parameters

##### ERROR_INVALID_SIGNATURE (0x41)

**Description:** Digital signature verification failed

**Causes:**

- Wrong private key used for signing
- Message tampering
- Signature format error

##### ERROR_KEY_GENERATION_FAILED (0x42)

**Description:** Cryptographic key generation failed

**Causes:**

- Insufficient entropy
- Invalid key parameters
- System randomness failure

## API Error Responses

### HTTP Status Codes

- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource state conflict
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side error
- **503 Service Unavailable**: Service temporarily unavailable

### Error Response Format

```json
{
  "error": {
    "code": "ERROR_INVALID_AMOUNT",
    "message": "Transaction amount must be greater than 0",
    "details": {
      "field": "amount",
      "provided": 0,
      "minimum": 1
    },
    "requestId": "req_1234567890",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

## Handling Strategies

### Retry Logic

```typescript
class LunarysErrorHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!this.isRetryableError(error) || attempt === maxRetries) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  static isRetryableError(error: any): boolean {
    const retryableCodes = [
      "ERROR_COMPUTATION_FAILED",
      "ERROR_COMPUTATION_TIMEOUT",
      "NETWORK_ERROR",
      "SERVICE_UNAVAILABLE",
    ];

    return retryableCodes.includes(error.code);
  }
}
```

### User-Friendly Messages

```typescript
const errorMessages = {
  ERROR_INVALID_AMOUNT: "Please enter a valid payment amount greater than 0.",
  ERROR_INSUFFICIENT_BALANCE:
    "Your account balance is too low for this transaction.",
  ERROR_INVALID_RECIPIENT: "Please provide a valid recipient address.",
  ERROR_COMPUTATION_FAILED:
    "Transaction processing is temporarily unavailable. Please try again.",
  ERROR_UNAUTHORIZED: "You are not authorized to perform this action.",
  NETWORK_ERROR:
    "Network connection failed. Please check your connection and try again.",
};

function getUserFriendlyMessage(errorCode: string): string {
  return (
    errorMessages[errorCode] ||
    "An unexpected error occurred. Please try again."
  );
}
```

### Error Monitoring

```typescript
class ErrorReporter {
  static report(error: LunarysError, context: any) {
    // Send to error tracking service
    console.error("LUNARYS Error:", {
      code: error.code,
      message: error.message,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });

    // Could integrate with services like:
    // - Sentry
    // - LogRocket
    // - DataDog
  }
}
```

## Best Practices

### Error Prevention

1. **Input Validation**: Validate all inputs client-side before submission
2. **Balance Checks**: Verify sufficient balance before transaction creation
3. **Network Checks**: Ensure network connectivity before API calls
4. **Key Management**: Secure private key handling

### Error Recovery

1. **Graceful Degradation**: Provide offline functionality when possible
2. **Clear Feedback**: Show clear error messages to users
3. **Recovery Options**: Offer ways to resolve errors (retry, alternative methods)
4. **Logging**: Comprehensive error logging for debugging

### User Experience

1. **Loading States**: Show loading indicators during async operations
2. **Progress Updates**: Keep users informed of long-running operations
3. **Help Resources**: Link to documentation for common errors
4. **Contact Support**: Provide support channels for persistent issues

## Testing Error Scenarios

### Unit Tests

```typescript
describe("Error Handling", () => {
  it("should handle invalid amounts", async () => {
    await expect(lunarys.createPayment({ amount: 0 })).rejects.toThrow(
      "ERROR_INVALID_AMOUNT"
    );
  });

  it("should handle insufficient balance", async () => {
    // Mock insufficient balance scenario
    mockBalance(0);

    await expect(lunarys.createPayment({ amount: 1000 })).rejects.toThrow(
      "ERROR_INSUFFICIENT_BALANCE"
    );
  });
});
```

### Integration Tests

```typescript
describe("End-to-End Error Scenarios", () => {
  it("should handle network failures gracefully", async () => {
    // Simulate network outage
    mockNetworkFailure();

    const result = await LunarysErrorHandler.withRetry(
      () => lunarys.submitPayment(payment),
      3
    );

    expect(result).toBeDefined();
  });
});
```

This comprehensive error handling approach ensures robust applications that can gracefully handle various failure scenarios while providing clear feedback to users.
