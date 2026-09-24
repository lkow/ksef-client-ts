#!/usr/bin/env node
import fs from 'node:fs';
import { buildSignedAuthTokenRequest, buildUnsignedAuthTokenRequest } from '../dist/index.js';

const baseUrl = resolveBaseUrl();
const certPath = process.env.KSEF_CERT_PEM;
const keyPath = process.env.KSEF_KEY_PEM;
const passphrase = process.env.KSEF_KEY_PASS;
const nip = process.env.KSEF_NIP ?? '1234567890';
const contextType = process.env.KSEF_CONTEXT_TYPE ?? 'Nip';
const subjectIdentifierType = process.env.KSEF_SUBJECT_IDENTIFIER_TYPE ?? 'certificateSubject';
const verifyChain = resolveVerifyChain();

if (!certPath || !keyPath) {
  console.error('Set KSEF_CERT_PEM and KSEF_KEY_PEM to PEM file paths.');
  process.exit(1);
}

const certPem = fs.readFileSync(certPath, 'utf8');
const keyPem = fs.readFileSync(keyPath, 'utf8');

const contextIdentifier = { type: contextType, value: nip };

const challenge = await postJson(`${baseUrl}/auth/challenge`);
if (!challenge?.challenge) {
  console.error('Challenge response missing challenge:', challenge);
  process.exit(1);
}

const unsignedXml = buildUnsignedAuthTokenRequest({
  challenge: challenge.challenge,
  contextIdentifier,
  subjectIdentifierType
});

const signedXml = buildSignedAuthTokenRequest(
  {
    challenge: challenge.challenge,
    contextIdentifier,
    subjectIdentifierType
  },
  {
    certificate: certPem,
    privateKey: keyPem,
    privateKeyPassword: passphrase
  }
);

dumpXmlArtifacts(unsignedXml, signedXml);

const authUrl = `${baseUrl}/auth/xades-signature${verifyChain ? `?verifyCertificateChain=${verifyChain}` : ''}`;
const authResponse = await fetch(authUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/xml' },
  body: signedXml
});

const authText = await authResponse.text();
console.log('Status:', authResponse.status);
  console.log(authText);

if (!authResponse.ok) {
  process.exit(2);
}

function dumpXmlArtifacts(unsignedXml, signedXml) {
  const outputDir = process.env.KSEF_OUTPUT_DIR;
  if (!outputDir) {
    return;
  }
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(`${outputDir}/auth-token-request.xml`, unsignedXml, 'utf8');
  fs.writeFileSync(`${outputDir}/auth-token-request-signed.xml`, signedXml, 'utf8');
  console.log('Saved XML to', outputDir);
}

async function postJson(url) {
  const response = await fetch(url, { method: 'POST' });
  const text = await response.text();
  if (!response.ok) {
    console.error('HTTP', response.status, text);
    process.exit(1);
  }
  try {
    return JSON.parse(text);
  } catch {
    console.error('Invalid JSON:', text);
    process.exit(1);
  }
}

function resolveBaseUrl() {
  const explicit = process.env.KSEF_BASE_URL;
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const env = (process.env.KSEF_ENV ?? 'test').toLowerCase();
  if (env === 'prod') {
    return 'https://api.ksef.mf.gov.pl/v2';
  }
  if (env === 'demo') {
    return 'https://api-demo.ksef.mf.gov.pl/v2';
  }
  return 'https://api-test.ksef.mf.gov.pl/v2';
}

function resolveVerifyChain() {
  if (process.env.KSEF_VERIFY_CHAIN) {
    return process.env.KSEF_VERIFY_CHAIN;
  }

  const env = (process.env.KSEF_ENV ?? 'test').toLowerCase();
  return env === 'prod' ? 'false' : 'true';
}
