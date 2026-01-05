import { describe, it, expect, vi, beforeEach } from 'vitest';
import { constants, privateDecrypt, generateKeyPairSync } from 'node:crypto';
import { SymmetricKeyManager } from '../../src/api2/crypto/symmetric.js';

// Generate a test RSA key pair for encryption/decryption tests
function generateTestKeyPair() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

describe('SymmetricKeyManager', () => {
  const { publicKey, privateKey } = generateTestKeyPair();

  const mockSecurityService = {
    getPublicKey: vi.fn().mockResolvedValue(publicKey)
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMaterial', () => {
    it('generates 32-byte symmetric key', async () => {
      const manager = new SymmetricKeyManager(mockSecurityService as any);
      const material = await manager.createMaterial();

      expect(material.symmetricKey).toBeInstanceOf(Buffer);
      expect(material.symmetricKey.byteLength).toBe(32);
    });

    it('generates 16-byte IV', async () => {
      const manager = new SymmetricKeyManager(mockSecurityService as any);
      const material = await manager.createMaterial();

      expect(material.initializationVector).toBeInstanceOf(Buffer);
      expect(material.initializationVector.byteLength).toBe(16);
    });

    it('encrypts symmetric key with RSA-OAEP using fetched public key', async () => {
      const manager = new SymmetricKeyManager(mockSecurityService as any);
      const material = await manager.createMaterial();

      // Verify getPublicKey was called with correct usage
      expect(mockSecurityService.getPublicKey).toHaveBeenCalledWith('SymmetricKeyEncryption');

      // Decrypt the encrypted symmetric key and verify it matches
      const encryptedBuffer = Buffer.from(material.encryptedSymmetricKey, 'base64');
      const decryptedKey = privateDecrypt(
        {
          key: privateKey,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        encryptedBuffer
      );

      expect(decryptedKey).toEqual(material.symmetricKey);
    });

    it('returns base64-encoded encrypted key', async () => {
      const manager = new SymmetricKeyManager(mockSecurityService as any);
      const material = await manager.createMaterial();

      expect(material.encryptedSymmetricKey).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('returns base64-encoded IV', async () => {
      const manager = new SymmetricKeyManager(mockSecurityService as any);
      const material = await manager.createMaterial();

      expect(material.initializationVectorBase64).toMatch(/^[A-Za-z0-9+/]+=*$/);
      
      // Verify it decodes to the same IV
      const decodedIv = Buffer.from(material.initializationVectorBase64, 'base64');
      expect(decodedIv).toEqual(material.initializationVector);
    });

    it('generates unique keys on each call', async () => {
      const manager = new SymmetricKeyManager(mockSecurityService as any);
      const material1 = await manager.createMaterial();
      const material2 = await manager.createMaterial();

      expect(material1.symmetricKey).not.toEqual(material2.symmetricKey);
      expect(material1.initializationVector).not.toEqual(material2.initializationVector);
    });

    it('uses custom key usage when specified', async () => {
      const manager = new SymmetricKeyManager(mockSecurityService as any, 'KsefTokenEncryption');
      await manager.createMaterial();

      expect(mockSecurityService.getPublicKey).toHaveBeenCalledWith('KsefTokenEncryption');
    });
  });
});

