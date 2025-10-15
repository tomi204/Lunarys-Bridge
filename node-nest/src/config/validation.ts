import * as Joi from 'joi';

export default Joi.object({
  PORT: Joi.number().default(5000),

  ETHEREUM_RPC_URL: Joi.string().uri().required(),
  ETHEREUM_PRIVATE_KEY: Joi.string().required(),
  NEW_RELAYER_ADDRESS: Joi.string().required(),

  SOLANA_RPC_URL: Joi.string().required(),
  SOLANA_PRIVATE_KEY: Joi.string().required(),

  BOND_AMOUNT: Joi.string().default('0.03'),
  POLL_INTERVAL: Joi.number().default(12000),

  FHEVM_CHAIN_ID: Joi.number().required(),
  FHEVM_GATEWAY_URL: Joi.string().uri().optional(),
  FHEVM_ACL_ADDRESS: Joi.string().optional(),
  FHEVM_KMS_VERIFIER_ADDRESS: Joi.string().optional(),

  RELAYER_API_URL: Joi.string().allow('').optional(),
  TEST_SOLANA_DESTINATION: Joi.string().allow('').optional(),
});
