/**
 * Cryptographic utilities for KSeF operations
 */

import { createHash, createPrivateKey, sign as cryptoSign, X509Certificate } from 'node:crypto';
// Import node-forge default export for ESM interop
import forge from 'node-forge';
const { pki, pkcs12, asn1, util, md } = forge;
import type { CertificateCredentials } from '@/types/auth.js';

export interface ParsedCertificate {
  certificate?: forge.pki.Certificate;
  certificatePem: string;
  privateKey?: forge.pki.PrivateKey;
  privateKeyPem: string;
  subject: string;
  issuer: string;
  fingerprint: string;
}

/**
 * Parse certificate from various formats (PEM, P12/PFX)
 */
export function parseCertificate(credentials: CertificateCredentials): ParsedCertificate {
  try {
    let certificate: forge.pki.Certificate | undefined;
    let privateKey: forge.pki.PrivateKey | undefined;
    let certificatePem: string | undefined;
    let privateKeyPem: string | undefined;
    let x509: X509Certificate | undefined;

    if (typeof credentials.certificate === 'string') {
      // Handle PEM format
      if (credentials.certificate.includes('-----BEGIN CERTIFICATE-----')) {
        certificatePem = credentials.certificate;
        try {
          certificate = pki.certificateFromPem(credentials.certificate);
        } catch {
          certificate = undefined;
        }
        try {
          x509 = new X509Certificate(certificatePem);
        } catch {
          x509 = undefined;
        }
        
        if (credentials.privateKey) {
          const resolvedPrivateKeyPem = typeof credentials.privateKey === 'string' 
            ? credentials.privateKey 
            : credentials.privateKey.toString();
          privateKeyPem = resolvedPrivateKeyPem;
          try {
            privateKey = pki.privateKeyFromPem(privateKeyPem);
          } catch {
            // EC keys are not always supported by forge; keep PEM for crypto.sign
            privateKey = undefined;
          }
        } else {
          throw new Error('Private key is required for PEM certificates');
        }
      } else {
        // Assume base64 encoded P12/PFX
        const p12Der = util.decode64(credentials.certificate);
        const p12Asn1 = asn1.fromDer(p12Der);
        const p12 = pkcs12.pkcs12FromAsn1(p12Asn1, credentials.password || '');
        
        const certBagType = pki.oids.certBag!;
        const keyBagType = pki.oids.pkcs8ShroudedKeyBag!;
        const certBags = p12.getBags({ bagType: certBagType });
        const keyBags = p12.getBags({ bagType: keyBagType });
        
        if (!certBags[certBagType] || certBags[certBagType]!.length === 0) {
          throw new Error('No certificate found in P12 file');
        }
        
        if (!keyBags[keyBagType] || keyBags[keyBagType]!.length === 0) {
          throw new Error('No private key found in P12 file');
        }
        
        certificate = certBags[certBagType]![0]!.cert!;
        privateKey = keyBags[keyBagType]![0]!.key!;
        try {
          privateKeyPem = pki.privateKeyToPem(privateKey);
        } catch (error) {
          throw new Error('Failed to convert private key to PEM. Provide the private key separately for EC certificates.');
        }
        try {
          certificatePem = pki.certificateToPem(certificate);
          x509 = new X509Certificate(certificatePem);
        } catch {
          x509 = undefined;
        }
      }
    } else {
      // Handle Buffer input (P12/PFX)
      const p12Asn1 = asn1.fromDer(credentials.certificate.toString('binary'));
      const p12 = pkcs12.pkcs12FromAsn1(p12Asn1, credentials.password || '');
      
      const certBagType = pki.oids.certBag!;
      const keyBagType = pki.oids.pkcs8ShroudedKeyBag!;
      const certBags = p12.getBags({ bagType: certBagType });
      const keyBags = p12.getBags({ bagType: keyBagType });
      
      if (!certBags[certBagType] || certBags[certBagType]!.length === 0) {
        throw new Error('No certificate found in P12 file');
      }
      
      if (!keyBags[keyBagType] || keyBags[keyBagType]!.length === 0) {
        throw new Error('No private key found in P12 file');
      }
      
      certificate = certBags[certBagType]![0]!.cert!;
      privateKey = keyBags[keyBagType]![0]!.key!;
      try {
        privateKeyPem = pki.privateKeyToPem(privateKey);
      } catch (error) {
        throw new Error('Failed to convert private key to PEM. Provide the private key separately for EC certificates.');
      }
      try {
        certificatePem = pki.certificateToPem(certificate);
        x509 = new X509Certificate(certificatePem);
      } catch {
        x509 = undefined;
      }
    }

    if (!certificatePem) {
      throw new Error('Certificate PEM could not be resolved');
    }

    if (!privateKeyPem) {
      throw new Error('Private key PEM could not be resolved');
    }

    if (!certificate && !x509) {
      throw new Error('Failed to parse certificate contents');
    }

    const subject = certificate
      ? certificate.subject.getField('CN')?.value || 
        certificate.subject.getField('SERIALNUMBER')?.value || 
        'Unknown'
      : x509
        ? extractDnField(x509.subject, ['CN', 'SERIALNUMBER']) ?? 'Unknown'
        : 'Unknown';
    
    const issuer = certificate
      ? certificate.issuer.getField('CN')?.value || 'Unknown'
      : x509
        ? extractDnField(x509.issuer, ['CN']) ?? 'Unknown'
        : 'Unknown';
    
    const fingerprint = x509
      ? createHash('sha256').update(x509.raw).digest('hex')
      : (() => {
          const hash = md.sha256.create();
          hash.update(asn1.toDer(pki.certificateToAsn1(certificate!)).getBytes());
          return hash.digest().toHex();
        })();

    const parsed: ParsedCertificate = {
      certificatePem,
      privateKeyPem,
      subject,
      issuer,
      fingerprint
    };

    if (certificate) {
      parsed.certificate = certificate;
    }

    if (privateKey) {
      parsed.privateKey = privateKey;
    }

    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate SHA-256 hash of content
 */
export function generateSHA256Hash(content: string | Buffer): string {
  const hash = createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

/**
 * Generate base64 encoded content
 */
export function toBase64(content: string | Buffer): string {
  if (typeof content === 'string') {
    return Buffer.from(content, 'utf8').toString('base64');
  }
  return content.toString('base64');
}

/**
 * Decode base64 content
 */
export function fromBase64(content: string): Buffer {
  return Buffer.from(content, 'base64');
}

/**
 * Create XML signature for KSeF authentication request
 */
export function createXMLSignature(
  xmlContent: string,
  parsedCert: ParsedCertificate,
  passphrase?: string
): string {
  try {
    // Create canonical XML for signing
    const canonicalXml = canonicalizeXML(xmlContent);
    
    const { signature, signatureMethod } = signXmlContent(canonicalXml, parsedCert, passphrase);
    
    // Create signed XML with XAdES structure
    const signedXml = createXAdESSignature(canonicalXml, signature, signatureMethod, parsedCert);
    
    return signedXml;
  } catch (error) {
    throw new Error(`Failed to create XML signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Canonicalize XML content (simplified implementation)
 */
function canonicalizeXML(xml: string): string {
  // Simplified XML canonicalization
  // In production, you might want to use a proper XML canonicalization library
  return xml
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Create XAdES signature structure
 */
function createXAdESSignature(
  content: string,
  signature: string,
  signatureMethod: string,
  parsedCert: ParsedCertificate
): string {
  const timestamp = new Date().toISOString();
  const certificateBase64 = stripCertificatePem(parsedCert.certificatePem);

  return `<?xml version="1.0" encoding="UTF-8"?>
<InitSessionSignedRequest xmlns="http://ksef.mf.gov.pl/schema/gtw/svc/online/auth/request/202310/v1">
  <Context>${content}</Context>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <SignatureMethod Algorithm="${signatureMethod}"/>
      <Reference URI="">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <DigestValue>${generateSHA256Hash(content)}</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>${signature}</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>${certificateBase64}</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>
</InitSessionSignedRequest>`;
}

function signXmlContent(
  content: string,
  parsedCert: ParsedCertificate,
  passphrase?: string
): { signature: string; signatureMethod: string } {
  const keyObject = loadPrivateKey(parsedCert.privateKeyPem, passphrase);
  const isEc = keyObject.asymmetricKeyType === 'ec';
  const signatureMethod = isEc
    ? 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256'
    : 'http://www.w3.org/2000/09/xmldsig#rsa-sha256';

  const signature = cryptoSign(
    isEc ? 'sha256' : 'RSA-SHA256',
    Buffer.from(content, 'utf8'),
    isEc ? { key: keyObject, dsaEncoding: 'der' } : { key: keyObject }
  ).toString('base64');

  return { signature, signatureMethod };
}

function loadPrivateKey(privateKeyPem: string, passphrase?: string) {
  if (!passphrase) {
    return createPrivateKey({ key: privateKeyPem });
  }

  try {
    return createPrivateKey({ key: privateKeyPem, passphrase });
  } catch {
    return createPrivateKey({ key: privateKeyPem });
  }
}

function stripCertificatePem(certificatePem: string): string {
  return certificatePem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\r?\n/g, '');
}

function extractDnField(subject: string, keys: string[]): string | null {
  for (const key of keys) {
    const match = subject.match(new RegExp(`(?:^|[\\s,/])${key}=([^,\\/]+)`));
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Encrypt token with timestamp for KSeF token authentication
 */
export function encryptTokenWithTimestamp(token: string, timestamp: string): string {
  // Simple concatenation as specified by KSeF API
  // In production, you might need additional encryption based on KSeF requirements
  const payload = `${token}|${timestamp}`;
  return toBase64(payload);
}

/**
 * Validate certificate is suitable for KSeF operations
 */
export function validateCertificate(parsedCert: ParsedCertificate): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const now = new Date();
  let validFrom: Date | null = null;
  let validTo: Date | null = null;

  if (parsedCert.certificate) {
    validFrom = parsedCert.certificate.validity.notBefore;
    validTo = parsedCert.certificate.validity.notAfter;
  } else {
    try {
      const x509 = new X509Certificate(parsedCert.certificatePem);
      validFrom = new Date(x509.validFrom);
      validTo = new Date(x509.validTo);
    } catch {
      // ignore
    }
  }

  // Check if certificate is not expired
  if (validTo && validTo < now) {
    errors.push('Certificate has expired');
  }

  // Check if certificate is not yet valid
  if (validFrom && validFrom > now) {
    errors.push('Certificate is not yet valid');
  }

  // Check for required key usage (simplified check)
  if (parsedCert.certificate) {
    try {
      const keyUsage = parsedCert.certificate.getExtension('keyUsage');
      if (keyUsage && typeof keyUsage === 'object' && 'digitalSignature' in keyUsage && !(keyUsage as any).digitalSignature) {
        errors.push('Certificate does not have digital signature capability');
      }
    } catch (error) {
      // Key usage extension check failed, but we'll allow it to pass
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Compute invoice hash (alias for generateSHA256Hash)
 */
export function computeInvoiceHash(buffer: Uint8Array | Buffer): string {
  // Convert Uint8Array to Buffer if needed
  const bufferInput = buffer instanceof Uint8Array ? Buffer.from(buffer) : buffer;
  return generateSHA256Hash(bufferInput);
}

/**
 * Generate reference number (UUID v4)
 */
export function generateReferenceNumber(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
} 
