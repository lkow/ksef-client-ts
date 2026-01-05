import { describe, it, expect } from 'vitest';
import { randomBytes, createDecipheriv } from 'node:crypto';
import {
  encryptInvoicePayload,
  encryptInvoiceCorrectionPayload,
  sha256Base64
} from '../../src/api2/crypto/encryption.js';
import type { SymmetricKeyMaterial } from '../../src/api2/crypto/symmetric.js';

function createTestEncryptionMaterial(): SymmetricKeyMaterial {
  const symmetricKey = randomBytes(32);
  const initializationVector = randomBytes(16);
  return {
    symmetricKey,
    initializationVector,
    encryptedSymmetricKey: 'mock-encrypted-key-base64',
    initializationVectorBase64: initializationVector.toString('base64')
  };
}

describe('sha256Base64', () => {
  it('produces correct SHA-256 hash for known input', () => {
    const input = Buffer.from('test', 'utf8');
    // SHA-256 of "test" is n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg
    const expected = 'n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=';
    expect(sha256Base64(input)).toBe(expected);
  });

  it('produces correct hash for empty buffer', () => {
    const input = Buffer.from('', 'utf8');
    // SHA-256 of empty string
    const expected = '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';
    expect(sha256Base64(input)).toBe(expected);
  });

  it('produces consistent output for same input', () => {
    const input = Buffer.from('consistent-test-data', 'utf8');
    const hash1 = sha256Base64(input);
    const hash2 = sha256Base64(input);
    expect(hash1).toBe(hash2);
  });

  it('produces different output for different input', () => {
    const input1 = Buffer.from('input1', 'utf8');
    const input2 = Buffer.from('input2', 'utf8');
    expect(sha256Base64(input1)).not.toBe(sha256Base64(input2));
  });
});

describe('encryptInvoicePayload', () => {
  const sampleXml = '<Invoice><Number>FV/2024/001</Number></Invoice>';
  
  it('populates all required payload fields', () => {
    const material = createTestEncryptionMaterial();
    const result = encryptInvoicePayload(sampleXml, material);

    expect(result.invoiceHash).toBeDefined();
    expect(result.invoiceSize).toBe(Buffer.from(sampleXml, 'utf8').byteLength);
    expect(result.encryptedInvoiceHash).toBeDefined();
    expect(result.encryptedInvoiceSize).toBeGreaterThan(0);
    expect(result.encryptedInvoiceContent).toBeDefined();
  });

  it('encrypts with AES-256-CBC and can be decrypted', () => {
    const material = createTestEncryptionMaterial();
    const result = encryptInvoicePayload(sampleXml, material);

    // Decrypt to verify
    const encryptedBuffer = Buffer.from(result.encryptedInvoiceContent, 'base64');
    const decipher = createDecipheriv(
      'aes-256-cbc',
      material.symmetricKey,
      material.initializationVector
    );
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final()
    ]).toString('utf8');

    expect(decrypted).toBe(sampleXml);
  });

  it('produces valid base64 encrypted content', () => {
    const material = createTestEncryptionMaterial();
    const result = encryptInvoicePayload(sampleXml, material);

    expect(result.encryptedInvoiceContent).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('handles Buffer input identically to string input', () => {
    const material = createTestEncryptionMaterial();
    const stringResult = encryptInvoicePayload(sampleXml, material);
    
    // Create new material with same keys for comparison
    const bufferMaterial: SymmetricKeyMaterial = {
      ...material,
      symmetricKey: Buffer.from(material.symmetricKey),
      initializationVector: Buffer.from(material.initializationVector)
    };
    const bufferResult = encryptInvoicePayload(Buffer.from(sampleXml, 'utf8'), bufferMaterial);

    expect(stringResult.invoiceHash).toBe(bufferResult.invoiceHash);
    expect(stringResult.invoiceSize).toBe(bufferResult.invoiceSize);
  });

  it('sets offlineMode when specified', () => {
    const material = createTestEncryptionMaterial();
    
    const resultWithOffline = encryptInvoicePayload(sampleXml, material, { offlineMode: true });
    expect(resultWithOffline.offlineMode).toBe(true);

    const resultWithoutOffline = encryptInvoicePayload(sampleXml, material, { offlineMode: false });
    expect(resultWithoutOffline.offlineMode).toBe(false);

    const resultDefault = encryptInvoicePayload(sampleXml, material);
    expect(resultDefault.offlineMode).toBeUndefined();
  });

  it('sets hashOfCorrectedInvoice to null by default', () => {
    const material = createTestEncryptionMaterial();
    const result = encryptInvoicePayload(sampleXml, material);
    expect(result.hashOfCorrectedInvoice).toBeNull();
  });

  it('includes hashOfCorrectedInvoice when provided', () => {
    const material = createTestEncryptionMaterial();
    const correctionHash = 'abc123base64hash=';
    const result = encryptInvoicePayload(sampleXml, material, {
      hashOfCorrectedInvoice: correctionHash
    });
    expect(result.hashOfCorrectedInvoice).toBe(correctionHash);
  });

  it('computes correct encrypted invoice size', () => {
    const material = createTestEncryptionMaterial();
    const result = encryptInvoicePayload(sampleXml, material);
    
    const encryptedBuffer = Buffer.from(result.encryptedInvoiceContent, 'base64');
    expect(result.encryptedInvoiceSize).toBe(encryptedBuffer.byteLength);
  });
});

describe('encryptInvoiceCorrectionPayload', () => {
  const correctionXml = '<Invoice><Number>FV/2024/001-K</Number></Invoice>';
  const originalXml = '<Invoice><Number>FV/2024/001</Number></Invoice>';

  it('computes and includes hash of corrected invoice', () => {
    const material = createTestEncryptionMaterial();
    const result = encryptInvoiceCorrectionPayload(correctionXml, originalXml, material);

    const expectedHash = sha256Base64(Buffer.from(originalXml, 'utf8'));
    expect(result.hashOfCorrectedInvoice).toBe(expectedHash);
  });

  it('encrypts the correction invoice, not the original', () => {
    const material = createTestEncryptionMaterial();
    const result = encryptInvoiceCorrectionPayload(correctionXml, originalXml, material);

    // Decrypt to verify correction XML was encrypted
    const encryptedBuffer = Buffer.from(result.encryptedInvoiceContent, 'base64');
    const decipher = createDecipheriv(
      'aes-256-cbc',
      material.symmetricKey,
      material.initializationVector
    );
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final()
    ]).toString('utf8');

    expect(decrypted).toBe(correctionXml);
  });

  it('handles Buffer input for both invoices', () => {
    const material = createTestEncryptionMaterial();
    const correctionBuffer = Buffer.from(correctionXml, 'utf8');
    const originalBuffer = Buffer.from(originalXml, 'utf8');
    
    const result = encryptInvoiceCorrectionPayload(correctionBuffer, originalBuffer, material);
    
    expect(result.hashOfCorrectedInvoice).toBe(sha256Base64(originalBuffer));
    expect(result.invoiceHash).toBe(sha256Base64(correctionBuffer));
  });

  it('passes through offlineMode option', () => {
    const material = createTestEncryptionMaterial();
    const result = encryptInvoiceCorrectionPayload(correctionXml, originalXml, material, {
      offlineMode: true
    });
    expect(result.offlineMode).toBe(true);
  });
});

