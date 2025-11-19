/**
 * QR code types for KSeF invoices
 * Based on: https://github.com/CIRFMF/ksef-docs/blob/main/kody-qr.md
 */

import type { ContextIdentifier } from './common.js';

/**
 * QR code format options
 */
export type QRCodeFormat = 'png' | 'svg' | 'dataurl' | 'utf8';

/**
 * QR code generation options
 */
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

/**
 * Offline certificate with private key for signing KOD II
 */
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

/**
 * Invoice QR code data structure
 */
export interface InvoiceQRCodeData {
  /** Invoice XML content (for hash calculation) */
  invoiceXml: string;
  
  /** Invoice issue date from P_1 field (will be formatted as DD-MM-YYYY) */
  invoiceDate: string;
  
  /** Seller NIP from invoice */
  sellerNip: string;
  
  /** KSeF reference number (for online invoices after submission) */
  ksefReferenceNumber?: string;
  
  /** Whether this is an offline invoice */
  isOffline?: boolean;
}

/**
 * KOD I (Invoice Verification) QR code
 * Used for ALL invoices (online and offline)
 * URL: https://ksef-test.mf.gov.pl/client-app/invoice/{sellerNip}/{date-DD-MM-YYYY}/{sha256HashBase64URL}
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
 * URL: https://ksef-test.mf.gov.pl/client-app/certificate/{contextType}/{contextValue}/{sellerNip}/{certSerial}/{sha256HashBase64URL}/{signatureBase64URL}
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

/**
 * Complete QR code set for an invoice
 */
export interface InvoiceQRCodes {
  /** KOD I - Invoice verification (always present) */
  kod1: Kod1QRCode;
  
  /** KOD II - Certificate verification (only for offline invoices) */
  kod2?: Kod2QRCode;
  
  /** Whether this is for an offline invoice */
  isOffline: boolean;
}

/**
 * QR code generation result
 */
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
 * QR code validation result
 */
export interface QRCodeValidation {
  /** Whether QR code is valid */
  valid: boolean;
  
  /** Decoded data if valid */
  decodedData?: InvoiceQRCodeData;
  
  /** Validation errors if invalid */
  errors?: string[];
}

/**
 * KSeF QR code URL structure
 * Based on official specification
 */
export interface KSeFQRCodeURL {
  /** Base URL for KSeF system */
  baseUrl: string;
  
  /** Context identifier type (nip/pesel) */
  contextType: 'nip' | 'pesel';
  
  /** Context identifier value */
  contextValue: string;
  
  /** KSeF reference number or verification code */
  identifier: string;
  
  /** Query parameters */
  params?: Record<string, string>;
}

/**
 * Parse KSeF QR code URL
 */
export function parseKSeFQRCodeURL(url: string): KSeFQRCodeURL | null {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    
    if (pathParts.length < 3) {
      return null;
    }
    
    const contextTypeStr = pathParts[0];
    const contextValue = pathParts[1];
    const identifier = pathParts[2];
    
    if (!contextTypeStr || !contextValue || !identifier) {
      return null;
    }
    
    const contextType = contextTypeStr.toLowerCase() as 'nip' | 'pesel';
    
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    const result: KSeFQRCodeURL = {
      baseUrl: `${parsed.protocol}//${parsed.host}`,
      contextType,
      contextValue,
      identifier
    };
    
    if (Object.keys(params).length > 0) {
      result.params = params;
    }
    
    return result;
  } catch {
    return null;
  }
}

/**
 * Build KSeF QR code URL
 */
export function buildKSeFQRCodeURL(data: Omit<KSeFQRCodeURL, 'baseUrl'>, environment: 'test' | 'prod' = 'prod'): string {
  const baseUrl = environment === 'prod' 
    ? 'https://ksef.mf.gov.pl' 
    : 'https://ksef-test.mf.gov.pl';
  
  let url = `${baseUrl}/${data.contextType}/${data.contextValue}/${data.identifier}`;
  
  if (data.params) {
    const searchParams = new URLSearchParams(data.params);
    url += `?${searchParams.toString()}`;
  }
  
  return url;
}

/**
 * Convert ISO date (YYYY-MM-DD) to DD-MM-YYYY format required by KSeF
 * Per kody-qr.md specification
 */
export function formatDateForQR(isoDate: string): string {
  // Handle both ISO 8601 full format and simple YYYY-MM-DD
  const date = new Date(isoDate);
  
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${isoDate}`);
  }
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
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
  
  // Add padding if needed (Base64 strings must be multiple of 4)
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  
  return base64;
}

