/**
 * Cryptographic signing utilities for KSeF KOD II generation
 * Based on: https://github.com/CIRFMF/ksef-docs/blob/main/kody-qr.md
 */

import { sign, verify, constants, createPublicKey, createPrivateKey, type KeyLike, KeyObject } from 'node:crypto';
import { toBase64URL, fromBase64URL } from './types.js';

/** Signature algorithm types supported by KSeF */
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
  const signOptions: {
    key: string | Buffer;
    padding: number;
    saltLength: number;
    passphrase?: string;
  } = {
    key: privateKey,
    padding: constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 32
  };

  if (password) {
    signOptions.passphrase = password;
  }

  const signature = sign('sha256', Buffer.from(data, 'utf8'), signOptions);

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
  const signOptions: {
    key: string | Buffer;
    dsaEncoding: 'ieee-p1363' | 'der';
    passphrase?: string;
  } = {
    key: privateKey,
    dsaEncoding: format
  };

  if (password) {
    signOptions.passphrase = password;
  }

  const signature = sign('sha256', Buffer.from(data, 'utf8'), signOptions);

  if (format === 'ieee-p1363' && signature.length !== 64) {
    throw new Error(`Invalid ECDSA P-256 signature length: expected 64 bytes, got ${signature.length}`);
  }

  return toBase64URL(signature.toString('base64'));
}

function getPrivateKeyType(privateKey: string | Buffer, password?: string): KeyObject['asymmetricKeyType'] {
  return createPrivateKey({
    key: privateKey,
    passphrase: password
  }).asymmetricKeyType;
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
  const keyType = getPrivateKeyType(privateKey, password);

  if (keyType === 'ec') {
    return signWithECDSA_P256(data, privateKey, password);
  }
  if (keyType === 'rsa') {
    return signWithRSA_PSS(data, privateKey, password);
  }

  throw new Error(`Unsupported private key type for KSeF QR signature: ${keyType ?? 'unknown'}`);
}

/**
 * Verify an RSA-PSS signature (for testing)
 */
export function verifyRSA_PSS(
  data: string,
  signatureBase64URL: string,
  publicKey: KeyLike
): boolean {
  try {
    const signatureBase64 = fromBase64URL(signatureBase64URL);
    const signature = Buffer.from(signatureBase64, 'base64');

    // Ensure we have a KeyObject for verify - convert string/Buffer to KeyObject
    const keyObject: KeyObject = publicKey instanceof KeyObject 
      ? publicKey 
      : createPublicKey(publicKey);

    return verify(
      'sha256',
      Buffer.from(data, 'utf8'),
      {
        key: keyObject,
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32
      },
      signature
    );
  } catch {
    return false;
  }
}

/**
 * Extract path from URL for signing
 *
 * Per kody-qr.md: Sign the path without https:// prefix and without trailing /
 * Example: qr-test.ksef.mf.gov.pl/certificate/Nip/1111111111/1111111111/01F20A5D352AE590/UtQp9Gpc51y-u3xApZjIjgkpZ01js-J8KflSPW8WzIE
 */
export function extractPathForSigning(url: string): string {
  let path = url.replace(/^https?:\/\//, '');
  path = path.replace(/\/$/, '');
  return path;
}
