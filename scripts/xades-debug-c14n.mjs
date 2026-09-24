#!/usr/bin/env node
/**
 * Diagnostic script to compare raw XML strings vs canonicalized output
 * and identify byte-level differences that cause signature mismatches.
 */
import fs from 'node:fs';
import { createHash, X509Certificate } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { ExclusiveCanonicalization } from 'xml-crypto';

const certPath = process.env.KSEF_CERT_PEM;
const keyPath = process.env.KSEF_KEY_PEM;

if (!certPath || !keyPath) {
  console.error('Set KSEF_CERT_PEM and KSEF_KEY_PEM to PEM file paths.');
  process.exit(1);
}

const certPem = fs.readFileSync(certPath, 'utf8');

// Constants matching xades-request.ts
const AUTH_NAMESPACE = 'http://ksef.mf.gov.pl/auth/token/2.0';
const DS_NS = 'http://www.w3.org/2000/09/xmldsig#';
const XADES_NS = 'http://uri.etsi.org/01903/v1.3.2#';
const SIGNED_PROPERTIES_TYPE = 'http://uri.etsi.org/01903#SignedProperties';
const C14N_EXC = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const ENVELOPED_SIGNATURE = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const DIGEST_SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';

// Get certificate details
const x509 = new X509Certificate(certPem);
const certificateDigestBase64 = createHash('sha256').update(x509.raw).digest('base64');
const issuerName = x509.issuer;
const subjectName = x509.subject;
const serialNumber = x509.serialNumber.replace(/[^0-9a-fA-F]/g, '');
const serialNumberDecimal = BigInt(`0x${serialNumber}`).toString(10);
const signingTime = new Date(Date.now() - 60_000).toISOString();

// Fixed IDs for reproducibility
const idSuffix = 'test-uuid-12345';
const signedPropertiesId = `SignedProperties_${idSuffix}`;
const signedSignaturePropertiesId = `SignedSignatureProperties_${idSuffix}`;
const signedDataObjectPropertiesId = `SignedDataObjectProperties_${idSuffix}`;
const referenceId = `Reference1_${idSuffix}`;
const signedPropertiesReferenceId = `SignedProperties-Reference_${idSuffix}`;
const signedInfoId = `SignedInfo_${idSuffix}`;

console.log('=== Certificate Details ===');
console.log('Issuer:', JSON.stringify(issuerName));
console.log('Subject:', JSON.stringify(subjectName));
console.log('Serial (hex):', serialNumber);
console.log('Serial (dec):', serialNumberDecimal);
console.log('Cert digest:', certificateDigestBase64);
console.log('');

// Build SignedProperties (matching your code)
const signedPropertiesXml = `<xades:SignedProperties xmlns="${AUTH_NAMESPACE}" xmlns:ds="${DS_NS}" xmlns:xades="${XADES_NS}" Id="${signedPropertiesId}"><xades:SignedSignatureProperties Id="${signedSignaturePropertiesId}"><xades:SigningTime>${signingTime}</xades:SigningTime><xades:SigningCertificate><xades:Cert><xades:CertDigest><ds:DigestMethod Algorithm="${DIGEST_SHA256}"/><ds:DigestValue>${certificateDigestBase64}</ds:DigestValue></xades:CertDigest><xades:IssuerSerial><ds:X509IssuerName>${issuerName}</ds:X509IssuerName><ds:X509SerialNumber>${serialNumberDecimal}</ds:X509SerialNumber></xades:IssuerSerial></xades:Cert></xades:SigningCertificate></xades:SignedSignatureProperties><xades:SignedDataObjectProperties Id="${signedDataObjectPropertiesId}"><xades:DataObjectFormat ObjectReference="#${referenceId}"><xades:MimeType>text/xml</xades:MimeType></xades:DataObjectFormat></xades:SignedDataObjectProperties></xades:SignedProperties>`;

console.log('=== SignedProperties (Raw) ===');
console.log('Length:', signedPropertiesXml.length);
console.log('SHA256:', createHash('sha256').update(signedPropertiesXml).digest('base64'));
console.log('');
console.log('Content:');
console.log(signedPropertiesXml);
console.log('');

// Build unsigned request (for root digest)
const challenge = 'test-challenge';
const nip = '1234567890';
const requestForDigest = `<AuthTokenRequest xmlns="${AUTH_NAMESPACE}" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Challenge>${challenge}</Challenge><ContextIdentifier><Nip>${nip}</Nip></ContextIdentifier><SubjectIdentifierType>certificateSubject</SubjectIdentifierType></AuthTokenRequest>`;

console.log('=== Root Document (for digest, no XML declaration) ===');
console.log('Length:', requestForDigest.length);
console.log('SHA256:', createHash('sha256').update(requestForDigest).digest('base64'));
console.log('');
console.log('Content:');
console.log(requestForDigest);
console.log('');

// Compute digests
const rootDigest = createHash('sha256').update(requestForDigest).digest('base64');
const signedPropertiesDigest = createHash('sha256').update(signedPropertiesXml).digest('base64');

// Build SignedInfo (matching your code with self-closing tags)
const signedInfoXmlSelfClosing = `<ds:SignedInfo xmlns:ds="${DS_NS}" Id="${signedInfoId}"><ds:CanonicalizationMethod Algorithm="${C14N_EXC}"/><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/><ds:Reference Id="${referenceId}" URI=""><ds:Transforms><ds:Transform Algorithm="${ENVELOPED_SIGNATURE}"/></ds:Transforms><ds:DigestMethod Algorithm="${DIGEST_SHA256}"/><ds:DigestValue>${rootDigest}</ds:DigestValue></ds:Reference><ds:Reference Id="${signedPropertiesReferenceId}" Type="${SIGNED_PROPERTIES_TYPE}" URI="#${signedPropertiesId}"><ds:DigestMethod Algorithm="${DIGEST_SHA256}"/><ds:DigestValue>${signedPropertiesDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;

// Build SignedInfo with explicit end tags (like Go code)
const signedInfoXmlEndTags = `<ds:SignedInfo xmlns:ds="${DS_NS}" Id="${signedInfoId}"><ds:CanonicalizationMethod Algorithm="${C14N_EXC}"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"></ds:SignatureMethod><ds:Reference Id="${referenceId}" URI=""><ds:Transforms><ds:Transform Algorithm="${ENVELOPED_SIGNATURE}"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="${DIGEST_SHA256}"></ds:DigestMethod><ds:DigestValue>${rootDigest}</ds:DigestValue></ds:Reference><ds:Reference Id="${signedPropertiesReferenceId}" Type="${SIGNED_PROPERTIES_TYPE}" URI="#${signedPropertiesId}"><ds:DigestMethod Algorithm="${DIGEST_SHA256}"></ds:DigestMethod><ds:DigestValue>${signedPropertiesDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;

console.log('=== SignedInfo Comparison ===');
console.log('');
console.log('--- Self-closing tags (current code) ---');
console.log('Length:', signedInfoXmlSelfClosing.length);
console.log('SHA256:', createHash('sha256').update(signedInfoXmlSelfClosing).digest('base64'));
console.log('');
console.log('--- Explicit end tags (Go style) ---');
console.log('Length:', signedInfoXmlEndTags.length);
console.log('SHA256:', createHash('sha256').update(signedInfoXmlEndTags).digest('base64'));
console.log('');

// Canonicalize SignedInfo (your current approach)
function canonicalizeSignedInfo(signedInfoXml) {
  const wrapper = `<AuthTokenRequest xmlns="${AUTH_NAMESPACE}" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><ds:Signature xmlns:ds="${DS_NS}">${signedInfoXml}</ds:Signature></AuthTokenRequest>`;
  const doc = new DOMParser().parseFromString(wrapper, 'application/xml');
  const signedInfo = doc.getElementsByTagNameNS(DS_NS, 'SignedInfo')[0];
  if (!signedInfo) {
    throw new Error('SignedInfo not found');
  }
  const c14n = new ExclusiveCanonicalization();
  return c14n.process(signedInfo);
}

const canonicalizedSelfClosing = canonicalizeSignedInfo(signedInfoXmlSelfClosing);
const canonicalizedEndTags = canonicalizeSignedInfo(signedInfoXmlEndTags);

console.log('--- Canonicalized (from self-closing) ---');
console.log('Length:', canonicalizedSelfClosing.length);
console.log('SHA256:', createHash('sha256').update(canonicalizedSelfClosing).digest('base64'));
console.log('');
console.log('--- Canonicalized (from end tags) ---');
console.log('Length:', canonicalizedEndTags.length);
console.log('SHA256:', createHash('sha256').update(canonicalizedEndTags).digest('base64'));
console.log('');

console.log('=== Byte-by-byte Comparison ===');
console.log('');
console.log('Raw (self-closing) vs Canonicalized:');
if (signedInfoXmlSelfClosing === canonicalizedSelfClosing) {
  console.log('  IDENTICAL');
} else {
  console.log('  DIFFERENT!');
  console.log('  Raw length:', signedInfoXmlSelfClosing.length);
  console.log('  Canonical length:', canonicalizedSelfClosing.length);

  // Find first difference
  for (let i = 0; i < Math.max(signedInfoXmlSelfClosing.length, canonicalizedSelfClosing.length); i++) {
    if (signedInfoXmlSelfClosing[i] !== canonicalizedSelfClosing[i]) {
      const start = Math.max(0, i - 20);
      const end = Math.min(Math.max(signedInfoXmlSelfClosing.length, canonicalizedSelfClosing.length), i + 40);
      console.log(`  First diff at position ${i}:`);
      console.log(`    Raw:       ...${JSON.stringify(signedInfoXmlSelfClosing.slice(start, end))}...`);
      console.log(`    Canonical: ...${JSON.stringify(canonicalizedSelfClosing.slice(start, end))}...`);
      console.log(`    Raw char:       ${JSON.stringify(signedInfoXmlSelfClosing[i])} (${signedInfoXmlSelfClosing.charCodeAt(i)})`);
      console.log(`    Canonical char: ${JSON.stringify(canonicalizedSelfClosing[i])} (${canonicalizedSelfClosing ? canonicalizedSelfClosing.charCodeAt(i) : 'N/A'})`);
      break;
    }
  }
}
console.log('');

console.log('Raw (end tags) vs Canonicalized:');
if (signedInfoXmlEndTags === canonicalizedEndTags) {
  console.log('  IDENTICAL');
} else {
  console.log('  DIFFERENT!');
  console.log('  Raw length:', signedInfoXmlEndTags.length);
  console.log('  Canonical length:', canonicalizedEndTags.length);
}
console.log('');

console.log('Canonicalized (self-closing) vs Canonicalized (end tags):');
if (canonicalizedSelfClosing === canonicalizedEndTags) {
  console.log('  IDENTICAL (canonicalization normalizes the difference)');
} else {
  console.log('  DIFFERENT!');
}
console.log('');

console.log('=== Full Canonical Output ===');
console.log('');
console.log(canonicalizedSelfClosing);
console.log('');

console.log('=== Hex Dump of First 200 Bytes ===');
console.log('');
console.log('Raw:');
console.log(Buffer.from(signedInfoXmlSelfClosing.slice(0, 200)).toString('hex').match(/.{1,2}/g).join(' '));
console.log('');
console.log('Canonical:');
console.log(Buffer.from(canonicalizedSelfClosing.slice(0, 200)).toString('hex').match(/.{1,2}/g).join(' '));
console.log('');

// Check for namespace differences specifically
console.log('=== Namespace Analysis ===');
const nsRegex = /xmlns[^=]*="[^"]*"/g;
const rawNamespaces = signedInfoXmlSelfClosing.match(nsRegex) || [];
const canonicalNamespaces = canonicalizedSelfClosing.match(nsRegex) || [];
console.log('Raw namespaces:', rawNamespaces);
console.log('Canonical namespaces:', canonicalNamespaces);
