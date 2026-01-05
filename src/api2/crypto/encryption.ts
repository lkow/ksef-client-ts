import { createCipheriv, createHash } from 'node:crypto';
import type { SymmetricKeyMaterial } from './symmetric.js';
import type { SendInvoiceRequestPayload } from '../types/invoice.js';
import type { Sha256HashBase64 } from '../types/common.js';

export interface EncryptedInvoicePayload extends SendInvoiceRequestPayload {}

/**
 * Encrypts invoice XML according to SendInvoiceRequest requirements:
 * - AES-256-CBC with PKCS#7 padding (same as Node's default for createCipheriv)
 * - SHA256 hashes encoded as Base64
 *
 * Reference: https://api-test.ksef.mf.gov.pl/docs/v2/index.html#tag/Wysylka-interaktywna/paths/~1sessions~1online~1%7BreferenceNumber%7D~1invoices/post
 */
export function encryptInvoicePayload(
  invoiceXml: string | Buffer,
  encryptionMaterial: SymmetricKeyMaterial,
  options?: { offlineMode?: boolean; hashOfCorrectedInvoice?: Sha256HashBase64 | null }
): EncryptedInvoicePayload {
  const invoiceBuffer = Buffer.isBuffer(invoiceXml) ? invoiceXml : Buffer.from(invoiceXml, 'utf8');
  const cipher = createCipheriv(
    'aes-256-cbc',
    encryptionMaterial.symmetricKey,
    encryptionMaterial.initializationVector
  );
  const encryptedBuffers = [cipher.update(invoiceBuffer), cipher.final()];
  const encryptedInvoice = Buffer.concat(encryptedBuffers);

  const result: EncryptedInvoicePayload = {
    invoiceHash: sha256Base64(invoiceBuffer),
    invoiceSize: invoiceBuffer.byteLength,
    encryptedInvoiceHash: sha256Base64(encryptedInvoice),
    encryptedInvoiceSize: encryptedInvoice.byteLength,
    encryptedInvoiceContent: encryptedInvoice.toString('base64'),
    hashOfCorrectedInvoice: options?.hashOfCorrectedInvoice ?? null
  };
  if (options?.offlineMode !== undefined) {
    result.offlineMode = options.offlineMode;
  }
  return result;
}

export function sha256Base64(data: Buffer): Sha256HashBase64 {
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('base64');
}

export function encryptInvoiceCorrectionPayload(
  invoiceXml: string | Buffer,
  correctedInvoiceXml: string | Buffer,
  encryptionMaterial: SymmetricKeyMaterial,
  options?: { offlineMode?: boolean }
): EncryptedInvoicePayload {
  const correctionBuffer = Buffer.isBuffer(correctedInvoiceXml)
    ? correctedInvoiceXml
    : Buffer.from(correctedInvoiceXml, 'utf8');
  const hashOfCorrectedInvoice = sha256Base64(correctionBuffer);
  return encryptInvoicePayload(invoiceXml, encryptionMaterial, {
    ...options,
    hashOfCorrectedInvoice
  });
}
