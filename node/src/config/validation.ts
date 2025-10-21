import * as Joi from 'joi';

export default Joi.object({
  PORT: Joi.number().default(5000),

  ETHEREUM_RPC_URL: Joi.string().uri().required(),
  ETHEREUM_PRIVATE_KEY: Joi.string().required(),
  NEW_RELAYER_ADDRESS: Joi.string().allow('').optional(),

  SOLANA_RPC_URL: Joi.string().required(),
  SOLANA_PRIVATE_KEY: Joi.string().required(),
  SOLANA_PROGRAM_ID: Joi.string().required(),

  // Optional (Variant B doesn’t use it)
  SOLANA_REQUEST_OWNER: Joi.string().allow('').optional(),

  BOND_AMOUNT: Joi.string().default('0.03'),
  POLL_INTERVAL: Joi.number().default(12000),

  FHEVM_CHAIN_ID: Joi.number().required(),
  FHEVM_GATEWAY_URL: Joi.string().uri().optional(),

  // ✅ Defaults live in the validator now
  FHEVM_ACL_ADDRESS: Joi.string().default('0x339EcE85B9E11a3A3AA557582784a15d7F82AAf2'),
  FHEVM_KMS_VERIFIER_ADDRESS: Joi.string().default('0x9D6891A6240D6130c54ae243d8005063D05fE14b'),

  RELAYER_API_URL: Joi.string().allow('').optional(),
  TEST_SOLANA_DESTINATION: Joi.string().allow('').optional(),
  TEST_EVM_DESTINATION: Joi.string().allow('').optional(),

  TOKEN_USDC: Joi.string().allow('').optional(),
  TOKEN_SOL: Joi.string().allow('').optional(),
  TOKEN_DECIMALS_EVM: Joi.number().default(6),
  TOKEN_DECIMALS_SOL: Joi.number().default(6),

  // Arcium (only what your node uses)
  ARCIUM_PROGRAM_ID: Joi.string().allow('').optional(),
  ARCIUM_MXE_PROGRAM_ID: Joi.string().required(),
  ARCIUM_COMPDEF_RESEAL_PDA: Joi.string().required(),
  ARCIUM_COMPDEF_PLAN_PAYOUT_PDA: Joi.string().allow('').optional(),
  ARCIUM_MXE_X25519_PUBLIC_KEY: Joi.string().allow('').optional(),

  SOLVER_X25519_SECRET: Joi.string().allow('').optional(),
});
