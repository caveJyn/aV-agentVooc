import { 
    elizaLogger,
    type Plugin 
} from '@elizaos/core';
import { generateProofAction } from './actions/generateProof';
import { verifyProofAction } from './actions/verifyProof';
import { zKproofProvider } from './providers/zKproofProvider';


export const zKproofPlugin: Plugin = {
name: 'zKproof',
description: 'Zero-knowledge proof generation and verification for agentVooc',
actions: [generateProofAction, verifyProofAction],
providers: [zKproofProvider],
};


export * from './types';
export * from './client';
export default zKproofPlugin;