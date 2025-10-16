// // src/utils/hash/index.ts
// import { hashSha256 } from './sha256';
// import { hashPoseidon } from './poseidon';
// import { getDomain } from './domain';

// export function hashSecret(type: string, secret: string, backend: 'snark' | 'stark' = 'snark') {
//   const domain = getDomain(type);
//   return backend === 'stark' ? hashPoseidon(domain, secret) : hashSha256(domain, secret);
// }
