/**
 * utils/starknet.ts
 * --------------------------------------------
 * Starknet integration layer for ZK proof submission & verification.
 *
 * - Handles interaction with deployed Cairo verifier contracts
 * - Currently uses placeholder ABI and address (replace when Garaga verifier is deployed)
 * - Modular: can adapt to any proof type or backend
 * --------------------------------------------
 */

import { Contract, Provider } from "starknet";
import type { ProofType } from "../types";

/**
 * Submits a proof and its public inputs to a Starknet verifier contract.
 *
 * @param proofType - The proof type (e.g. 'userId', 'customerId', 'transaction')
 * @param proof - The generated ZK proof object
 * @param publicInputs - The public inputs used during proof generation
 * @returns The transaction receipt or verification result from Starknet
 */
export async function submitProofToStarknet(
  proofType: ProofType,
  proof: any,
  publicInputs: any
) {
  // ⚙️ TODO: Replace with deployed verifier contract once available
  const VERIFIER_ADDRESS = process.env.STARKNET_VERIFIER_ADDRESS || "0x...";
  const VERIFIER_ABI = []; // load actual ABI JSON once compiled via Garaga → Cairo

  // Create a Starknet provider (auto-detects testnet/mainnet)
  const provider = new Provider({ sequencer: { network: "testnet" } });

  // Initialize contract instance
  const contract = new Contract(VERIFIER_ABI, VERIFIER_ADDRESS, provider);

  // Prepare calldata — adjust layout according to verifier contract signature
  const calldata = [proof, publicInputs?.derived];

  try {
    // Send transaction to on-chain verifier
    const tx = await contract.call("verify_proof", calldata);

    // Expected to return true/false or transaction hash depending on contract logic
    return tx;
  } catch (error: any) {
    console.error(`[ZKProof] Starknet verification failed: ${error.message}`);
    throw new Error(`Starknet proof verification failed: ${error.message}`);
  }
}
