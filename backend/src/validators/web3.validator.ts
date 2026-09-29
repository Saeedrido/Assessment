import { z } from 'zod';

/** An Ethereum address, validated loosely and checksummed later by ethers. */
const addressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'must be a 20-byte hex Ethereum address');

export const verifySignatureBodySchema = z.object({
  message: z.string().trim().min(1, 'message is required').max(2000),
  signature: z.string().trim().regex(/^0x[0-9a-fA-F]+$/, 'must be a hex string'),
  expectedAddress: addressSchema,
});

export type VerifySignatureBody = z.infer<typeof verifySignatureBodySchema>;
