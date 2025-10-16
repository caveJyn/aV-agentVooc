/**
 * utils/hash.ts
 * -------------------------------------------------------
 * Deterministic domain-separated hashing for ElizaOS ZK Proofs.
 *
 * Used to derive reproducible commitments for ZK circuits:
 *   - Prevents hash collisions across proof types.
 *   - Ensures stable outputs for deterministic UUID mapping.
 *
 * Example domain tags:
 *   eliza:userId:v1
 *   eliza:customerId:v1
 *   eliza:transaction:v1
 *
 * -------------------------------------------------------
 */

import crypto from "crypto";

/**
 * Hashes a user secret with a domain-separated label.
 *
 * @param type - The proof type (e.g., 'userId', 'customerId', 'transaction')
 * @param secret - The secret (e.g., Clerk userId, StripeId, etc.)
 * @returns A deterministic 0x-prefixed SHA-256 hash
 */
export function hashSecret(type: string, secret: string): string {
  const domain = `eliza:${type}:v1`; // versioned domain separation
  const hash = crypto
    .createHash("sha256")
    .update(domain)
    .update(secret)
    .digest("hex");

  return `0x${hash}`;
}

/**
 * Utility: Safe hash comparison (timing-attack resistant)
 */
export function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a.replace(/^0x/, ""), "hex");
  const bufB = Buffer.from(b.replace(/^0x/, ""), "hex");
  return crypto.timingSafeEqual(bufA, bufB);
}
