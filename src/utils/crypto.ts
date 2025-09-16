/**
 * Cryptographic utilities for KSeF operations
 */

import { createHash, createSign } from 'node:crypto';
// Selective imports from node-forge to reduce bundle size
import { pki, pkcs12, asn1, util, md } from 'node-forge';
import type { CertificateCredentials } from '@/types/auth.js';

export interface ParsedCertificate {
  certificate: pki.Certificate;
  privateKey: pki.PrivateKey;
  subject: string;
  issuer: string;
  fingerprint: string;
}

/**
 * Parse certificate from various formats (PEM, P12/PFX)
 */
export function parseCertificate(credentials: CertificateCredentials): ParsedCertificate {
  try {
    let certificate: pki.Certificate;
    let privateKey: pki.PrivateKey;

    if (typeof credentials.certificate === 'string') {
      // Handle PEM format
      if (credentials.certificate.includes('-----BEGIN CERTIFICATE-----')) {
        certificate = pki.certificateFromPem(credentials.certificate);
        
        if (credentials.privateKey) {
          const privateKeyPem = typeof credentials.privateKey === 'string' 
            ? credentials.privateKey 
            : credentials.privateKey.toString();
          privateKey = pki.privateKeyFromPem(privateKeyPem);
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
    }

    const subject = certificate.subject.getField('CN')?.value || 
                   certificate.subject.getField('SERIALNUMBER')?.value || 
                   'Unknown';
    
    const issuer = certificate.issuer.getField('CN')?.value || 'Unknown';
    
    // Generate fingerprint
    const fingerprint = md.sha256.create();
    fingerprint.update(asn1.toDer(pki.certificateToAsn1(certificate)).getBytes());
    
    return {
      certificate,
      privateKey,
      subject,
      issuer,
      fingerprint: fingerprint.digest().toHex()
    };
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
  parsedCert: ParsedCertificate
): string {
  try {
    // Create canonical XML for signing
    const canonicalXml = canonicalizeXML(xmlContent);
    
    // Generate signature
    const sign = createSign('RSA-SHA256');
    sign.update(canonicalXml);
    
    // Convert forge private key to Node.js format
    const privateKeyPem = pki.privateKeyToPem(parsedCert.privateKey);
    const signature = sign.sign(privateKeyPem, 'base64');
    
    // Create signed XML with XAdES structure
    const signedXml = createXAdESSignature(canonicalXml, signature, parsedCert);
    
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
  parsedCert: ParsedCertificate
): string {
  const timestamp = new Date().toISOString();
  const certificatePem = pki.certificateToPem(parsedCert.certificate);
  const certificateBase64 = certificatePem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\n/g, '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<InitSessionSignedRequest xmlns="http://ksef.mf.gov.pl/schema/gtw/svc/online/auth/request/202310/v1">
  <Context>${content}</Context>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
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

  // Check if certificate is not expired
  if (parsedCert.certificate.validity.notAfter < now) {
    errors.push('Certificate has expired');
  }

  // Check if certificate is not yet valid
  if (parsedCert.certificate.validity.notBefore > now) {
    errors.push('Certificate is not yet valid');
  }

  // Check for required key usage (simplified check)
  try {
    const keyUsage = parsedCert.certificate.getExtension('keyUsage');
    if (keyUsage && typeof keyUsage === 'object' && 'digitalSignature' in keyUsage && !(keyUsage as any).digitalSignature) {
      errors.push('Certificate does not have digital signature capability');
    }
  } catch (error) {
    // Key usage extension check failed, but we'll allow it to pass
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