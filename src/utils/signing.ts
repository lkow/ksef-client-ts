/**
 * Cryptographic signing utilities for KSeF KOD II generation
 * Based on: https://github.com/CIRFMF/ksef-docs/blob/main/kody-qr.md
 */

import { createSign, createHash } from 'node:crypto';
import { toBase64URL } from '@/types/qr-code.js';

/**
 * Signature algorithm types supported by KSeF
 */
export enum SignatureAlgorithm {
  /** RSA with PSS padding - Minimum 2048-bit key */
  RSA_PSS = 'RSA-PSS',
  
  /** ECDSA with P-256 curve (secp256r1) */
  ECDSA_P256 = 'ECDSA-P256'
}

/**
 * Sign a string using RSA-PSS algorithm
 * 
 * Per kody-qr.md specification:
 * - Hash function: SHA-256
 * - MGF: MGF1 with SHA-256
 * - Salt length: 32 bytes
 * - Minimum key length: 2048 bits
 * 
 * @param data - Data to sign (URL path without https:// and trailing /)
 * @param privateKey - RSA private key (PEM format)
 * @param password - Private key password if encrypted
 * @returns Base64URL encoded signature
 */
export function signWithRSA_PSS(
  data: string,
  privateKey: string | Buffer,
  password?: string
): string {
  // Hash the data with SHA-256
  const hash = createHash('sha256').update(data, 'utf8').digest();
  
  // Create signature with RSA-PSS
  const sign = createSign('RSA-SHA256');
  sign.update(hash);
  
  const signOptions: any = {
    key: privateKey,
    padding: 1, // RSA_PKCS1_PSS_PADDING
    saltLength: 32,
    // PSS options
    mgf1Hash: 'sha256'
  };
  
  if (password) {
    signOptions.passphrase = password;
  }
  
  const signature = sign.sign(signOptions);
  
  // Convert to Base64URL
  return toBase64URL(signature.toString('base64'));
}

/**
 * Sign a string using ECDSA with P-256 curve
 * 
 * Per kody-qr.md specification:
 * - Hash function: SHA-256
 * - Curve: NIST P-256 (secp256r1)
 * - Format: IEEE P1363 (recommended) - fixed 64 bytes (R || S)
 * 
 * @param data - Data to sign (URL path without https:// and trailing /)
 * @param privateKey - ECDSA private key (PEM format, P-256 curve)
 * @param password - Private key password if encrypted
 * @param format - Signature format ('ieee-p1363' recommended, 'der' fallback)
 * @returns Base64URL encoded signature
 */
export function signWithECDSA_P256(
  data: string,
  privateKey: string | Buffer,
  password?: string,
  format: 'ieee-p1363' | 'der' = 'ieee-p1363'
): string {
  // Hash the data with SHA-256
  const hash = createHash('sha256').update(data, 'utf8').digest();
  
  // Create signature with ECDSA
  const sign = createSign('SHA256');
  sign.update(hash);
  
  const signOptions: any = {
    key: privateKey,
    dsaEncoding: format === 'ieee-p1363' ? 'ieee-p1363' : 'der'
  };
  
  if (password) {
    signOptions.passphrase = password;
  }
  
  const signature = sign.sign(signOptions);
  
  // IEEE P1363 format is 64 bytes for P-256 (32 bytes R + 32 bytes S)
  if (format === 'ieee-p1363' && signature.length !== 64) {
    throw new Error(`Invalid ECDSA P-256 signature length: expected 64 bytes, got ${signature.length}`);
  }
  
  // Convert to Base64URL
  return toBase64URL(signature.toString('base64'));
}

/**
 * Auto-detect signature algorithm from private key and sign
 * 
 * @param data - Data to sign
 * @param privateKey - Private key (PEM format)
 * @param password - Private key password if encrypted
 * @returns Base64URL encoded signature
 */
export function signAuto(
  data: string,
  privateKey: string | Buffer,
  password?: string
): string {
  const keyString = Buffer.isBuffer(privateKey) ? privateKey.toString('utf8') : privateKey;
  
  // Detect key type from PEM header
  if (keyString.includes('BEGIN EC PRIVATE KEY') || keyString.includes('BEGIN PRIVATE KEY')) {
    // Try ECDSA first (P-256 is required)
    try {
      return signWithECDSA_P256(data, privateKey, password);
    } catch (error) {
      // If ECDSA fails, might be RSA with EC header, try RSA
      return signWithRSA_PSS(data, privateKey, password);
    }
  } else if (keyString.includes('BEGIN RSA PRIVATE KEY')) {
    // RSA key
    return signWithRSA_PSS(data, privateKey, password);
  }
  
  // Default to RSA-PSS if unsure
  return signWithRSA_PSS(data, privateKey, password);
}

/**
 * Verify an RSA-PSS signature (for testing)
 */
export function verifyRSA_PSS(
  data: string,
  signatureBase64URL: string,
  publicKey: string | Buffer
): boolean {
  try {
    const { createVerify } = require('crypto');
    const { fromBase64URL } = require('@/types/qr-code.js');
    
    // Convert Base64URL to Buffer
    const signatureBase64 = fromBase64URL(signatureBase64URL);
    const signature = Buffer.from(signatureBase64, 'base64');
    
    // Hash the data
    const hash = createHash('sha256').update(data, 'utf8').digest();
    
    // Verify signature
    const verify = createVerify('RSA-SHA256');
    verify.update(hash);
    
    return verify.verify(
      {
        key: publicKey,
        padding: 1, // RSA_PKCS1_PSS_PADDING
        saltLength: 32,
        mgf1Hash: 'sha256'
      },
      signature
    );
  } catch (error) {
    return false;
  }
}

/**
 * Extract path from URL for signing
 * 
 * Per kody-qr.md: Sign the path without https:// prefix and without trailing /
 * Example: ksef-test.mf.gov.pl/client-app/certificate/Nip/1111111111/1111111111/01F20A5D352AE590/UtQp9Gpc51y-u3xApZjIjgkpZ01js-J8KflSPW8WzIE
 */
export function extractPathForSigning(url: string): string {
  // Remove protocol if present
  let path = url.replace(/^https?:\/\//, '');
  
  // Remove trailing slash if present
  path = path.replace(/\/$/, '');
  
  return path;
}


