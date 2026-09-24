#!/usr/bin/env node
/**
 * Verification script for XAdES signatures.
 * Verifies signatures against raw SignedInfo string (matching Go implementation).
 */
import fs from 'node:fs';
import { createHash, createVerify, X509Certificate } from 'node:crypto';
import { buildSignedAuthTokenRequest, buildUnsignedAuthTokenRequest } from '../dist/index.js';

const certPath = process.env.KSEF_CERT_PEM;
const keyPath = process.env.KSEF_KEY_PEM;
const passphrase = process.env.KSEF_KEY_PASS;

if (!certPath || !keyPath) {
  console.error('Set KSEF_CERT_PEM and KSEF_KEY_PEM to PEM file paths.');
  process.exit(1);
}

const certPem = fs.readFileSync(certPath, 'utf8');
const keyPem = fs.readFileSync(keyPath, 'utf8');
const challenge = process.env.KSEF_CHALLENGE ?? 'test-challenge';
const nip = process.env.KSEF_NIP ?? '1234567890';

const params = {
  challenge,
  contextIdentifier: { type: 'Nip', value: nip },
  subjectIdentifierType: 'certificateSubject'
};

const signedXml = buildSignedAuthTokenRequest(params, {
  certificate: certPem,
  privateKey: keyPem,
  privateKeyPassword: passphrase
});

const unsignedForDigest = buildUnsignedAuthTokenRequest(params, false, false);

// Extract SignedInfo (raw string with explicit end tags)
const signedInfo = signedXml.match(/<ds:SignedInfo[\s\S]*?<\/ds:SignedInfo>/)?.[0];
const signatureValue = extractTag(signedXml, 'ds:SignatureValue');
const signatureMethod = extractSignatureMethod(signedXml);
const rootDigestFromXml = extractReferenceDigest(signedXml, '');
const signedPropsXml = signedXml.match(/<xades:SignedProperties[\s\S]*?<\/xades:SignedProperties>/)?.[0];
const signedPropsId = signedPropsXml?.match(/Id="([^"]+)"/)?.[1] ?? null;
const signedPropsDigestFromXml = signedPropsId ? extractReferenceDigest(signedXml, `#${signedPropsId}`) : null;

const rootDigest = sha256Base64(unsignedForDigest);
const signedPropsDigest = signedPropsXml ? sha256Base64(signedPropsXml) : null;

const x509 = new X509Certificate(certPem);
const publicKey = x509.publicKey;
const isEc = publicKey.asymmetricKeyType === 'ec';

// Verify signature against raw SignedInfo string (no canonicalization needed)
const signatureOk = verifySignature({
  signedInfo,
  signatureValue,
  publicKey,
  isEc
});

console.log('Signature method:', signatureMethod ?? 'not found');
console.log('Signature verify:', signatureOk ? 'OK' : 'FAIL');
console.log('Root digest match:', rootDigestFromXml === rootDigest ? 'OK' : 'FAIL');
console.log('SignedProperties digest match:', signedPropsDigestFromXml === signedPropsDigest ? 'OK' : 'FAIL');

if (process.env.DEBUG) {
  console.log('\n=== Debug Info ===');
  console.log('SignedInfo length:', signedInfo?.length);
  console.log('SignedInfo hash:', signedInfo ? sha256Base64(signedInfo) : 'N/A');
  console.log('Root digest (computed):', rootDigest);
  console.log('Root digest (from XML):', rootDigestFromXml);
  console.log('SignedProps digest (computed):', signedPropsDigest);
  console.log('SignedProps digest (from XML):', signedPropsDigestFromXml);
}

if (!signatureOk || rootDigestFromXml !== rootDigest || signedPropsDigestFromXml !== signedPropsDigest) {
  process.exit(2);
}

function extractTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`));
  return match?.[1] ?? null;
}

function extractSignatureMethod(xml) {
  const match = xml.match(/<ds:SignatureMethod[^>]*Algorithm="([^"]+)"/);
  return match?.[1] ?? null;
}

function extractReferenceDigest(xml, uri) {
  const escaped = uri.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const match = xml.match(
    new RegExp(`<ds:Reference[^>]*URI="${escaped}"[\\s\\S]*?<ds:DigestValue>([^<]+)</ds:DigestValue>`)
  );
  return match?.[1] ?? null;
}

function sha256Base64(content) {
  return createHash('sha256').update(content, 'utf8').digest('base64');
}

function verifySignature({ signedInfo, signatureValue, publicKey, isEc }) {
  if (!signedInfo || !signatureValue) {
    return false;
  }
  // Verify against raw SignedInfo string (no canonicalization).
  // Since we use explicit end tags, raw string is canonical-equivalent.
  const verifier = createVerify(isEc ? 'sha256' : 'RSA-SHA256');
  verifier.update(signedInfo);
  verifier.end();
  return verifier.verify(
    isEc ? { key: publicKey, dsaEncoding: 'ieee-p1363' } : publicKey,
    Buffer.from(signatureValue, 'base64')
  );
}
