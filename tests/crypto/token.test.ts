import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, privateDecrypt, constants } from 'node:crypto';
import { encryptTokenPayload } from '../../src/api2/crypto/token.js';

// Generate a test RSA key pair for encryption/decryption tests
function generateTestKeyPair() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

describe('encryptTokenPayload', () => {
  const testToken = 'test-ksef-token-value';
  const { publicKey, privateKey } = generateTestKeyPair();

  it('encrypts token|timestamp payload with RSA-OAEP', () => {
    const timestamp = 1704067200000; // 2024-01-01T00:00:00.000Z
    const encrypted = encryptTokenPayload(testToken, timestamp, publicKey);

    // Verify output is valid base64
    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);

    // Decrypt and verify payload format
    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const decrypted = privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedBuffer
    ).toString('utf8');

    expect(decrypted).toBe(`${testToken}|${timestamp}`);
  });

  it('handles numeric timestamp', () => {
    const timestamp = 1704067200000;
    const encrypted = encryptTokenPayload(testToken, timestamp, publicKey);

    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const decrypted = privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedBuffer
    ).toString('utf8');

    expect(decrypted).toBe(`${testToken}|1704067200000`);
  });

  it('handles string milliseconds timestamp', () => {
    const timestamp = '1704067200000';
    const encrypted = encryptTokenPayload(testToken, timestamp, publicKey);

    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const decrypted = privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedBuffer
    ).toString('utf8');

    expect(decrypted).toBe(`${testToken}|1704067200000`);
  });

  it('handles string with whitespace padding', () => {
    const timestamp = '  1704067200000  ';
    const encrypted = encryptTokenPayload(testToken, timestamp, publicKey);

    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const decrypted = privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedBuffer
    ).toString('utf8');

    expect(decrypted).toBe(`${testToken}|1704067200000`);
  });

  it('handles ISO date string timestamp', () => {
    const isoDate = '2024-01-01T00:00:00.000Z';
    const expectedMillis = Date.parse(isoDate);
    const encrypted = encryptTokenPayload(testToken, isoDate, publicKey);

    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const decrypted = privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedBuffer
    ).toString('utf8');

    expect(decrypted).toBe(`${testToken}|${expectedMillis}`);
  });

  it('throws on invalid timestamp string', () => {
    expect(() => {
      encryptTokenPayload(testToken, 'not-a-valid-date', publicKey);
    }).toThrow(/Invalid challenge timestamp/);
  });

  it('throws on empty string timestamp', () => {
    expect(() => {
      encryptTokenPayload(testToken, '', publicKey);
    }).toThrow(/Invalid challenge timestamp/);
  });

  it('throws on NaN number', () => {
    expect(() => {
      encryptTokenPayload(testToken, NaN, publicKey);
    }).toThrow(/Invalid challenge timestamp/);
  });

  it('throws on Infinity', () => {
    expect(() => {
      encryptTokenPayload(testToken, Infinity, publicKey);
    }).toThrow(/Invalid challenge timestamp/);
  });

  it('throws on negative Infinity', () => {
    expect(() => {
      encryptTokenPayload(testToken, -Infinity, publicKey);
    }).toThrow(/Invalid challenge timestamp/);
  });

  it('produces different output for different tokens', () => {
    const timestamp = 1704067200000;
    const encrypted1 = encryptTokenPayload('token-1', timestamp, publicKey);
    const encrypted2 = encryptTokenPayload('token-2', timestamp, publicKey);
    
    // Due to OAEP padding randomness, outputs will differ
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('produces different output for different timestamps', () => {
    const encrypted1 = encryptTokenPayload(testToken, 1704067200000, publicKey);
    const encrypted2 = encryptTokenPayload(testToken, 1704067200001, publicKey);
    
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('handles zero timestamp', () => {
    const timestamp = 0;
    const encrypted = encryptTokenPayload(testToken, timestamp, publicKey);

    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const decrypted = privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedBuffer
    ).toString('utf8');

    expect(decrypted).toBe(`${testToken}|0`);
  });
});

