export interface EmailTemplate {
  _id?: string;
  _type: string;
  agentId: string;
  position: string;
  emailAddress: string;
  companyName: string;
  instructions: string;
  bestRegard: string;
  template?: string; // Optional, used for full email structure
}