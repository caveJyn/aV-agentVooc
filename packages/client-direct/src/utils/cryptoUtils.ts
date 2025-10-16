// packages/client-direct/src/utils/cryptoUtils.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// console.log('Raw ENCRYPTION_KEY:', ENCRYPTION_KEY, 'Length:', ENCRYPTION_KEY?.length); // Debug raw key and length
if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is not set');
}

// Validate key format and length
let keyBuffer: Buffer;
try {
  // console.log('Attempting hex decode of ENCRYPTION_KEY:', ENCRYPTION_KEY);
  keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
  // console.log('Key Buffer:', keyBuffer.toString('hex'), 'Length:', keyBuffer.length);
  if (keyBuffer.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must be a 64-character hex string (32 bytes), got ${keyBuffer.length} bytes after hex decoding`);
  }
  // Verify hex string validity
  if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    throw new Error(`ENCRYPTION_KEY contains invalid hex characters or incorrect length: ${ENCRYPTION_KEY}`);
  }
} catch (error) {
  // console.error('Invalid ENCRYPTION_KEY format:', error.message, 'Raw Value:', ENCRYPTION_KEY);
  throw error;
}

// Encrypt a value using AES-256-CBC
export function encryptValue(value: string): { iv: string; ciphertext: string } {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encrypted = cipher.update(value, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return { iv: iv.toString('base64'), ciphertext: encrypted };
  } catch (error) {
    // console.error('Encryption failed for value:', value, 'Error:', error.message);
    throw error;
  }
}

// Decrypt a value using AES-256-CBC
export function decryptValue(iv: string | undefined, ciphertext: string): string {
  if (!iv) return ciphertext; // Return plaintext for non-unique keys
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, Buffer.from(iv, 'base64'));
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // console.error('Decryption failed for ciphertext:', ciphertext, 'Error:', error.message);
    throw error;
  }
}

// Compute SHA-256 hash for duplicate checking
export function computeHash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}