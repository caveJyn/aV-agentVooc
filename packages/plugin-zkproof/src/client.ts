/**
 * client.ts
 * --------------------------------------------
 * Browser-side ZK proof helper.
 *
 * Responsibilities:
 * 1️⃣ For user identity (Clerk → internalUserId), only derive anonymized value.
 * 2️⃣ For transaction proofs (Chipi Pay, cross-chain), generate ZK proofs in-browser.
 * 3️⃣ Backend selection: Barretenberg (SNARK) by default, Garaga placeholder for future STARK support.
 *
 * Artifacts: Expected under /public/zk/<type>.json
 * --------------------------------------------
 */

import { Noir } from '@noir-lang/noir_js';
import { Barretenberg } from '@aztec/bb.js'; // Future: swap with GaragaWasmBackend
import { hashSecret } from './utils/hash';
import type { ProofType, GeneratedProof } from './types';

// Configurable backend selection
export const BACKEND = process.env.ZK_BACKEND || 'barretenberg'; // later => 'garaga'

/**
 * Derive anonymized value from a secret without generating a full ZK proof.
 * Use this for Clerk userId → internalUserId mapping.
 *
 * @param type - Type of derivation (e.g. 'userId', 'subscription')
 * @param secret - Secret value (Clerk userId, StripeId, etc.)
 * @returns Derived value (anonymized, deterministic)
 */
export function deriveValue(type: ProofType, secret: string): string {
  return hashSecret(type, secret);
}

/**
 * Generate a full zero-knowledge proof.
 * Use this for transaction-level proofs that will later be verified on-chain.
 *
 * @param type - Circuit type (e.g., 'transaction', 'character')
 * @param secret - User secret (internalUserId, walletId, etc.)
 * @returns GeneratedProof object with proof + derived value
 */
export async function generateProof(type: ProofType, secret: string): Promise<GeneratedProof> {
  // 1️⃣ Derive deterministic commitment
  const derivedValue = hashSecret(type, secret);

  // 2️⃣ Load circuit artifact
  const resp = await fetch(`/zk/${type}.json`);
  if (!resp.ok) throw new Error(`Failed to fetch circuit artifact for ${type}`);
  const circuit = await resp.json();

  // 3️⃣ Initialize Noir instance
  const noir = new Noir(circuit);

  // 4️⃣ Initialize backend
  let backend;
  if (BACKEND === 'barretenberg') {
    backend = await Barretenberg.new(circuit.bytecode);
  } else {
    // Placeholder for Garaga integration
    throw new Error('Garaga backend not yet implemented');
  }

  // 5️⃣ Prepare inputs for the circuit
  const inputs = { secret }; // Expand per circuit definition (internalUserId, timestamp, etc.)

  // 6️⃣ Execute circuit to compute witness
  const { witness } = await noir.execute(inputs);

  // 7️⃣ Generate proof (browser-side)
  const proof = await backend.generateProof(witness);

  return {
    derivedValue,
    proof,
  };
}

/**
 * Utility wrapper for modular usage:
 * - use deriveValue for identity mapping (lightweight, no proof)
 * - use generateProof for transaction-level ZK proofs
 */
export const zkClient = {
  deriveValue,
  generateProof,
};
