import { createCipheriv, createHash } from 'node:crypto';
import type { SymmetricKeyMaterial } from '../crypto/symmetric.js';

export function sha256Base64(buffer: Buffer): string {
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('base64');
}

export function encryptPart(part: Buffer, encryptionMaterial: SymmetricKeyMaterial): Buffer {
  const cipher = createCipheriv(
    'aes-256-cbc',
    encryptionMaterial.symmetricKey,
    encryptionMaterial.initializationVector
  );
  return Buffer.concat([cipher.update(part), cipher.final()]);
}
