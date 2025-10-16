export interface PrivacyProvider {
  // Generate a blind token for anonymous membership (e.g., Cashu-inspired, Idea #7)
  requestBlindToken(runeOwnershipProof: string): Promise<string>;
  // Generate ZK proof for membership without revealing address (Idea #7)
  generateMembershipProof(userId: string, runeId: string): Promise<{ proof: string; publicInput: string }>;
  // Create ephemeral Starknet account for private transactions (Idea #5)
  createEphemeralAccount(): Promise<{ address: string; privateKey: string }>;
  // Verify ZK proof (e.g., for voting eligibility)
  verifyProof(proof: string, publicInput: string): Promise<boolean>;
}