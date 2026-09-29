import { getAddress, verifyMessage } from 'ethers';

/**
 * Signed-message verification, isolated behind an interface so services never
 * depend on a specific signing library.
 */
export interface SignatureVerifier {
  /** Resolves the signer address, or `null` when the signature is invalid. */
  recoverSigner(message: string, signature: string): string | null;
}

export interface VerifySignatureInput {
  message: string;
  signature: string;
  /** Address the client claims signed the message. */
  expectedAddress: string;
}

export type SignatureVerificationResult =
  | { valid: true; address: string }
  | { valid: false; reason: string };

/** EIP-191 personal_sign verification via ethers. */
export class EthersSignatureVerifier implements SignatureVerifier {
  recoverSigner(message: string, signature: string): string | null {
    try {
      return verifyMessage(message, signature);
    } catch {
      return null;
    }
  }
}

export const signatureVerifier: SignatureVerifier = new EthersSignatureVerifier();

/**
 * Verifies a signature and checks it matches the claimed address.
 *
 * Addresses are compared in EIP-55 checksum form, because the same address can
 * be written with different letter casing.
 */
export function verifySignedMessage(
  input: VerifySignatureInput,
  verifier: SignatureVerifier = signatureVerifier,
): SignatureVerificationResult {
  const recovered = verifier.recoverSigner(input.message, input.signature);
  if (!recovered) {
    return { valid: false, reason: 'Signature could not be recovered from the message' };
  }

  try {
    const matches = getAddress(recovered) === getAddress(input.expectedAddress);
    return matches
      ? { valid: true, address: recovered }
      : { valid: false, reason: 'Signature was produced by a different address' };
  } catch {
    return { valid: false, reason: 'Address or signature is not a valid Ethereum address' };
  }
}
