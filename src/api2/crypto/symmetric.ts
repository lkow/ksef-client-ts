import { constants, publicEncrypt, randomBytes } from 'node:crypto';
import type { PublicKeyUsage, SecurityService } from '../security.js';

export interface SymmetricKeyMaterial {
  /** raw 32-byte key kept locally for encrypting payloads */
  symmetricKey: Buffer;
  /** raw 16-byte IV */
  initializationVector: Buffer;
  /** Base64-encoded RSA-encrypted symmetric key */
  encryptedSymmetricKey: string;
  /** Base64 IV for transport */
  initializationVectorBase64: string;
}

export class SymmetricKeyManager {
  constructor(
    private readonly securityService: SecurityService,
    private readonly keyUsage: PublicKeyUsage = 'SymmetricKeyEncryption'
  ) {}

  async createMaterial(): Promise<SymmetricKeyMaterial> {
    const symmetricKey = randomBytes(32);
    const initializationVector = randomBytes(16);
    const publicKey = await this.securityService.getPublicKey(this.keyUsage);

    const encryptedSymmetricKey = publicEncrypt(
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      symmetricKey
    ).toString('base64');

    return {
      symmetricKey,
      initializationVector,
      encryptedSymmetricKey,
      initializationVectorBase64: initializationVector.toString('base64')
    };
  }
}
