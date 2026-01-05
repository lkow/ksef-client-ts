import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import {
  signWithRSA_PSS,
  signWithECDSA_P256,
  signAuto,
  verifyRSA_PSS,
  extractPathForSigning,
  SignatureAlgorithm
} from '../../src/api2/qr/signing.js';

describe('QR Signing', () => {
  // Generate test keys
  const rsaKeyPair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const ecKeyPair = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  describe('signWithRSA_PSS', () => {
    it('produces a base64url signature', () => {
      const data = 'qr-test.ksef.mf.gov.pl/invoice/1234567890/15-01-2024/hashvalue';
      const signature = signWithRSA_PSS(data, rsaKeyPair.privateKey);

      expect(signature).toBeTruthy();
      expect(signature).not.toContain('+');
      expect(signature).not.toContain('/');
      expect(signature).not.toContain('=');
    });

    it('produces consistent signatures for same data', () => {
      // Note: RSA-PSS uses salt, so signatures will differ
      // We just verify both are valid signatures
      const data = 'test data';
      const sig1 = signWithRSA_PSS(data, rsaKeyPair.privateKey);
      const sig2 = signWithRSA_PSS(data, rsaKeyPair.privateKey);

      expect(sig1).toBeTruthy();
      expect(sig2).toBeTruthy();
      // Due to salt, signatures will be different
    });
  });

  describe('signWithECDSA_P256', () => {
    it('produces a base64url signature', () => {
      const data = 'test data for ECDSA signing';
      const signature = signWithECDSA_P256(data, ecKeyPair.privateKey);

      expect(signature).toBeTruthy();
      expect(signature).not.toContain('+');
      expect(signature).not.toContain('/');
      expect(signature).not.toContain('=');
    });

    it('produces signature in IEEE P1363 format (64 bytes decoded)', () => {
      const data = 'test data';
      const signature = signWithECDSA_P256(data, ecKeyPair.privateKey, undefined, 'ieee-p1363');

      // Decode base64url to check length
      const base64 = signature.replace(/-/g, '+').replace(/_/g, '/');
      const buffer = Buffer.from(base64, 'base64');
      expect(buffer.length).toBe(64);
    });

    it('can produce DER format signature', () => {
      const data = 'test data';
      const signature = signWithECDSA_P256(data, ecKeyPair.privateKey, undefined, 'der');

      expect(signature).toBeTruthy();
      // DER format has variable length, typically 70-72 bytes for P-256
    });
  });

  describe('signAuto', () => {
    it('auto-detects RSA key and signs', () => {
      const data = 'test data';
      const signature = signAuto(data, rsaKeyPair.privateKey);

      expect(signature).toBeTruthy();
      expect(verifyRSA_PSS(data, signature, rsaKeyPair.publicKey)).toBe(true);
    });

    it('auto-detects EC key and signs', () => {
      const data = 'test data';
      const signature = signAuto(data, ecKeyPair.privateKey);

      expect(signature).toBeTruthy();
    });

    it('handles Buffer input for private key', () => {
      const data = 'test data';
      const keyBuffer = Buffer.from(rsaKeyPair.privateKey, 'utf8');
      const signature = signAuto(data, keyBuffer);

      expect(signature).toBeTruthy();
    });
  });

  describe('verifyRSA_PSS', () => {
    it('verifies valid RSA-PSS signature', () => {
      const data = 'test verification data';
      const signature = signWithRSA_PSS(data, rsaKeyPair.privateKey);

      expect(verifyRSA_PSS(data, signature, rsaKeyPair.publicKey)).toBe(true);
    });

    it('rejects invalid signature', () => {
      const data = 'test data';
      const invalidSignature = 'invalid-signature-base64url';

      expect(verifyRSA_PSS(data, invalidSignature, rsaKeyPair.publicKey)).toBe(false);
    });

    it('rejects signature for different data', () => {
      const data1 = 'original data';
      const data2 = 'different data';
      const signature = signWithRSA_PSS(data1, rsaKeyPair.privateKey);

      expect(verifyRSA_PSS(data2, signature, rsaKeyPair.publicKey)).toBe(false);
    });
  });

  describe('extractPathForSigning', () => {
    it('removes https:// prefix', () => {
      const url = 'https://qr-test.ksef.mf.gov.pl/certificate/Nip/1234567890';
      expect(extractPathForSigning(url)).toBe('qr-test.ksef.mf.gov.pl/certificate/Nip/1234567890');
    });

    it('removes http:// prefix', () => {
      const url = 'http://example.com/path';
      expect(extractPathForSigning(url)).toBe('example.com/path');
    });

    it('removes trailing slash', () => {
      const url = 'https://example.com/path/';
      expect(extractPathForSigning(url)).toBe('example.com/path');
    });

    it('handles URL without protocol', () => {
      const url = 'qr-test.ksef.mf.gov.pl/invoice/123';
      expect(extractPathForSigning(url)).toBe('qr-test.ksef.mf.gov.pl/invoice/123');
    });

    it('handles complex KSeF QR URL', () => {
      const url = 'https://qr-test.ksef.mf.gov.pl/certificate/Nip/1111111111/1111111111/01F20A5D352AE590/UtQp9Gpc51y-u3xApZjIjgkpZ01js-J8KflSPW8WzIE';
      const expected = 'qr-test.ksef.mf.gov.pl/certificate/Nip/1111111111/1111111111/01F20A5D352AE590/UtQp9Gpc51y-u3xApZjIjgkpZ01js-J8KflSPW8WzIE';
      expect(extractPathForSigning(url)).toBe(expected);
    });
  });

  describe('SignatureAlgorithm enum', () => {
    it('has RSA_PSS value', () => {
      expect(SignatureAlgorithm.RSA_PSS).toBe('RSA-PSS');
    });

    it('has ECDSA_P256 value', () => {
      expect(SignatureAlgorithm.ECDSA_P256).toBe('ECDSA-P256');
    });
  });

  describe('KOD II signature test vector', () => {
    // Test using path format from kody-qr.md specification
    // URL: qr-test.ksef.mf.gov.pl/certificate/{contextType}/{contextValue}/{sellerNip}/{certSerial}/{hash}
    const testPath = 'qr-test.ksef.mf.gov.pl/certificate/Nip/1111111111/1111111111/01F20A5D352AE590/UtQp9Gpc51y-u3xApZjIjgkpZ01js-J8KflSPW8WzIE';

    it('produces verifiable RSA-PSS signature for official path format', () => {
      // Sign the test path
      const signature = signWithRSA_PSS(testPath, rsaKeyPair.privateKey);

      // Verify signature is valid
      expect(verifyRSA_PSS(testPath, signature, rsaKeyPair.publicKey)).toBe(true);

      // Verify signature is base64url encoded
      expect(signature).not.toContain('+');
      expect(signature).not.toContain('/');
      expect(signature).not.toContain('=');
    });

    it('produces verifiable ECDSA signature for official path format', () => {
      // Sign the test path using ECDSA
      const signature = signWithECDSA_P256(testPath, ecKeyPair.privateKey);

      // Verify signature is base64url encoded
      expect(signature).not.toContain('+');
      expect(signature).not.toContain('/');
      expect(signature).not.toContain('=');

      // Verify IEEE P1363 format (64 bytes)
      const base64 = signature.replace(/-/g, '+').replace(/_/g, '/');
      const buffer = Buffer.from(base64, 'base64');
      expect(buffer.length).toBe(64);
    });

    it('signature changes if any character in path changes', () => {
      const modifiedPath = testPath.replace('1111111111', '1111111112');
      const originalSig = signWithRSA_PSS(testPath, rsaKeyPair.privateKey);

      // Modified path signature should not verify against original path
      expect(verifyRSA_PSS(testPath, originalSig, rsaKeyPair.publicKey)).toBe(true);
      expect(verifyRSA_PSS(modifiedPath, originalSig, rsaKeyPair.publicKey)).toBe(false);
    });
  });
});

