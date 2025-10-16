export type ProofType = 'userId' | 'customerId' | 'transaction';

export interface GeneratedProof {
  derivedValue: string; // Hex-encoded hash
  proof: any; // Serialized proof (depends on backend)
}

export interface ProofRequest {
  type: ProofType;
  secret: string; // Clerk userId or Stripe customerId
}