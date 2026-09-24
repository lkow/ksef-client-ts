#!/usr/bin/env node
/**
 * Debug script to compare SignedProperties: raw string vs canonicalized in context
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { ExclusiveCanonicalization } from 'xml-crypto';

const signedXmlPath = process.env.SIGNED_XML ?? './xades-artifacts/auth-token-request-signed.xml';

if (!fs.existsSync(signedXmlPath)) {
  console.error('Signed XML not found:', signedXmlPath);
  process.exit(1);
}

const signedXml = fs.readFileSync(signedXmlPath, 'utf8');

// Extract SignedProperties via regex (raw string as it appears in document)
const signedPropsMatch = signedXml.match(/<xades:SignedProperties[\s\S]*?<\/xades:SignedProperties>/);
if (!signedPropsMatch) {
  console.error('SignedProperties not found in XML');
  process.exit(1);
}

const signedPropsRaw = signedPropsMatch[0];

// Extract the stored digest
const signedPropsId = signedPropsRaw.match(/Id="([^"]+)"/)?.[1];
const storedDigest = signedXml.match(
  new RegExp(`<ds:Reference[^>]*URI="#${signedPropsId}"[\\s\\S]*?<ds:DigestValue>([^<]+)</ds:DigestValue>`)
)?.[1];

console.log('=== SignedProperties Analysis ===\n');
console.log('SignedProperties ID:', signedPropsId);
console.log('Stored digest in XML:', storedDigest);
console.log('');

// Hash the raw string as extracted
const rawHash = createHash('sha256').update(signedPropsRaw, 'utf8').digest('base64');
console.log('--- Raw String (as extracted from document) ---');
console.log('Length:', signedPropsRaw.length);
console.log('SHA256:', rawHash);
console.log('Match stored?', rawHash === storedDigest ? 'YES' : 'NO');
console.log('');

// Parse the full document and canonicalize SignedProperties in context
const XADES_NS = 'http://uri.etsi.org/01903/v1.3.2#';
const doc = new DOMParser().parseFromString(signedXml, 'application/xml');
const signedPropsElem = doc.getElementsByTagNameNS(XADES_NS, 'SignedProperties')[0];

if (!signedPropsElem) {
  console.error('SignedProperties element not found in parsed DOM');
  process.exit(1);
}

const c14n = new ExclusiveCanonicalization();
const canonicalSignedProps = c14n.process(signedPropsElem);
const canonicalHash = createHash('sha256').update(canonicalSignedProps, 'utf8').digest('base64');

console.log('--- Canonicalized (exc-c14n in document context) ---');
console.log('Length:', canonicalSignedProps.length);
console.log('SHA256:', canonicalHash);
console.log('Match stored?', canonicalHash === storedDigest ? 'YES' : 'NO');
console.log('');

// Show the difference
console.log('=== Byte Comparison ===\n');
console.log('Raw == Canonical?', signedPropsRaw === canonicalSignedProps ? 'YES' : 'NO');
console.log('');

if (signedPropsRaw !== canonicalSignedProps) {
  console.log('First difference:');
  for (let i = 0; i < Math.max(signedPropsRaw.length, canonicalSignedProps.length); i++) {
    if (signedPropsRaw[i] !== canonicalSignedProps[i]) {
      const start = Math.max(0, i - 30);
      const end = Math.min(Math.max(signedPropsRaw.length, canonicalSignedProps.length), i + 50);
      console.log(`  Position ${i}:`);
      console.log(`  Raw:       ...${JSON.stringify(signedPropsRaw.slice(start, end))}...`);
      console.log(`  Canonical: ...${JSON.stringify(canonicalSignedProps.slice(start, end))}...`);
      break;
    }
  }
  console.log('');

  // Show namespace declarations
  console.log('=== Namespace Declarations ===\n');
  const rawNs = signedPropsRaw.match(/xmlns[^=]*="[^"]*"/g) || [];
  const canonicalNs = canonicalSignedProps.match(/xmlns[^=]*="[^"]*"/g) || [];
  console.log('Raw namespaces:', rawNs);
  console.log('Canonical namespaces:', canonicalNs);
}

console.log('\n=== Full Canonical Output ===\n');
console.log(canonicalSignedProps);
