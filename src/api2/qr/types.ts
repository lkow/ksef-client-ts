/**
 * QR code types for KSeF invoices (API v2)
 * Based on: https://github.com/CIRFMF/ksef-docs/blob/main/kody-qr.md
 */

import type { ApiV2Environment, ContextIdentifier } from '../types/common.js';

/** QR code output format */
export type QRCodeFormat = 'png' | 'svg' | 'dataurl' | 'utf8';

/** QR code generation options */
export interface QRCodeOptions {
  /** Output format (default: 'dataurl') */
  format?: QRCodeFormat;

  /** Error correction level (default: 'M') */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';

  /** QR code width in pixels (default: 256) */
  width?: number;

  /** QR code margin in modules (default: 4) */
  margin?: number;

  /** Color options */
  color?: {
    /** Dark color (default: '#000000') */
    dark?: string;
    /** Light color (default: '#ffffff') */
    light?: string;
  };
}

/**
 * Certificate type for KSeF operations
 * Based on: https://github.com/CIRFMF/ksef-docs/blob/main/certyfikaty-KSeF.md
 */
export enum CertificateType {
  /** Authentication certificate - keyUsage: Digital Signature (80) */
  AUTHENTICATION = 'Authentication',

  /** Offline certificate - keyUsage: Non-Repudiation (40) */
  OFFLINE = 'Offline'
}

/** Offline certificate with private key for signing KOD II */
export interface OfflineCertificate {
  /** Certificate data (PEM or DER format) */
  certificate: string | Buffer;

  /** Private key for signing (PEM or DER format) */
  privateKey: string | Buffer;

  /** Certificate serial number (hex string) */
  serialNumber: string;

  /** Private key password if encrypted */
  password?: string;

  /** Certificate type (must be Offline for KOD II) */
  type: CertificateType.OFFLINE;
}

/** Invoice QR code data structure */
export interface InvoiceQRCodeData {
  /** Invoice XML content (for hash calculation) */
  invoiceXml: string;

  /** Invoice issue date from P_1 field (will be formatted as DD-MM-YYYY) */
  invoiceDate: string;

  /** Seller NIP from invoice */
  sellerNip: string;

  /** Context identifier used for KOD II (defaults to seller NIP if omitted) */
  contextIdentifier?: ContextIdentifier;

  /** KSeF reference number (for online invoices after submission) */
  ksefReferenceNumber?: string;

  /** Whether this is an offline invoice */
  isOffline?: boolean;
}

/** QR code generation result */
export interface QRCodeResult {
  /** QR code data (format depends on options) */
  data: string | Buffer;

  /** Format used */
  format: QRCodeFormat;

  /** Original input data */
  inputData: string;

  /** Generation timestamp */
  timestamp: string;
}

/**
 * KOD I (Invoice Verification) QR code
 * Used for ALL invoices (online and offline)
 * URL: https://qr-{env}.ksef.mf.gov.pl/invoice/{sellerNip}/{date-DD-MM-YYYY}/{sha256HashBase64URL}
 */
export interface Kod1QRCode {
  /** QR code data (image or URL) */
  qrCode: QRCodeResult;

  /** Label to display under QR: KSeF number or "OFFLINE" */
  label: string;

  /** The verification URL */
  url: string;
}

/**
 * KOD II (Certificate Verification) QR code
 * ONLY for offline invoices
 * URL: https://qr-{env}.ksef.mf.gov.pl/certificate/{contextType}/{contextValue}/{sellerNip}/{certSerial}/{sha256HashBase64URL}/{signatureBase64URL}
 */
export interface Kod2QRCode {
  /** QR code data (image or URL) */
  qrCode: QRCodeResult;

  /** Label to display under QR: "CERTYFIKAT" */
  label: 'CERTYFIKAT';

  /** The verification URL */
  url: string;

  /** Certificate serial number used */
  certificateSerialNumber: string;
}

/** Complete QR code set for an invoice */
export interface InvoiceQRCodes {
  /** KOD I - Invoice verification (always present) */
  kod1: Kod1QRCode;

  /** KOD II - Certificate verification (only for offline invoices) */
  kod2?: Kod2QRCode;

  /** Whether this is for an offline invoice */
  isOffline: boolean;
}

/** QR base URLs by environment */
export const QR_BASE_URLS: Record<ApiV2Environment, string> = {
  test: 'https://qr-test.ksef.mf.gov.pl',
  demo: 'https://qr-demo.ksef.mf.gov.pl',
  prod: 'https://qr.ksef.mf.gov.pl'
};

/**
 * Convert ISO date (YYYY-MM-DD) to DD-MM-YYYY format required by KSeF
 * Per kody-qr.md specification
 * 
 * Parses the date string directly to avoid timezone issues that can occur
 * when using Date object with local time getters near midnight.
 */
export function formatDateForQR(isoDate: string): string {
  // Parse YYYY-MM-DD directly to avoid timezone issues
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    throw new Error(`Invalid date format: ${isoDate}. Expected YYYY-MM-DD`);
  }
  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
}

/**
 * Convert standard Base64 to Base64URL encoding
 * Base64URL uses - and _ instead of + and /, and removes padding =
 */
export function toBase64URL(base64: string): string {
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convert Base64URL to standard Base64
 */
export function fromBase64URL(base64url: string): string {
  let base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  return base64;
}

