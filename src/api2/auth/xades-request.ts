import { createHash, createPrivateKey, sign as cryptoSign } from 'node:crypto';
import type { CertificateCredentials } from '@/types/auth.js';
import { parseCertificate, type ParsedCertificate } from '@/utils/crypto.js';
import type { ContextIdentifier } from '../types/common.js';

export type SubjectIdentifierTypeV2 = 'certificateSubject' | 'certificateFingerprint';

export interface BuildAuthTokenRequestParams {
  challenge: string;
  contextIdentifier: ContextIdentifier;
  subjectIdentifierType: SubjectIdentifierTypeV2;
}

const AUTH_NAMESPACE = 'http://ksef.mf.gov.pl/auth/token/2.0';
const DS_NS = 'http://www.w3.org/2000/09/xmldsig#';

export function buildSignedAuthTokenRequest(
  params: BuildAuthTokenRequestParams,
  credentials: CertificateCredentials
): string {
  const parsedCertificate = parseCertificate(credentials);
  const requestWithoutSignature = buildUnsignedAuthTokenRequest(params);
  const canonical = canonicalizeXml(requestWithoutSignature);

  const signedInfoDigest = sha256Base64(Buffer.from(canonical, 'utf8'));
  const passphrase = credentials.privateKeyPassword ?? credentials.password;
  const { signatureValue, signatureMethod } = createXmlSignature(canonical, parsedCertificate, passphrase);
  const certificateBase64 = encodeCertificate(parsedCertificate.certificatePem);

  const signatureXml = `
  <ds:Signature xmlns:ds="${DS_NS}">
    <ds:SignedInfo>
      <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <ds:SignatureMethod Algorithm="${signatureMethod}"/>
      <ds:Reference URI="">
        <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <ds:DigestValue>${signedInfoDigest}</ds:DigestValue>
      </ds:Reference>
    </ds:SignedInfo>
    <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
    <ds:KeyInfo>
      <ds:X509Data>
        <ds:X509Certificate>${certificateBase64}</ds:X509Certificate>
      </ds:X509Data>
    </ds:KeyInfo>
  </ds:Signature>`;

  return requestWithoutSignature.replace('</AuthTokenRequest>', `${signatureXml}\n</AuthTokenRequest>`);
}

export function buildUnsignedAuthTokenRequest(params: BuildAuthTokenRequestParams): string {
  const contextXml = buildContextIdentifier(params.contextIdentifier);
  return `<?xml version="1.0" encoding="utf-8"?>
<AuthTokenRequest xmlns="${AUTH_NAMESPACE}" xmlns:ds="${DS_NS}">
  <Challenge>${params.challenge}</Challenge>
  <ContextIdentifier>
    ${contextXml}
  </ContextIdentifier>
  <SubjectIdentifierType>${params.subjectIdentifierType}</SubjectIdentifierType>
</AuthTokenRequest>`;
}

function buildContextIdentifier(context: ContextIdentifier): string {
  switch (context.type) {
    case 'Nip':
      return `<Nip>${context.value}</Nip>`;
    case 'InternalId':
      return `<InternalId>${context.value}</InternalId>`;
    case 'NipVatUe':
      return `<NipVatUe>${context.value}</NipVatUe>`;
    case 'PeppolId':
      return `<PeppolId>${context.value}</PeppolId>`;
    default:
      throw new Error(`Unsupported context identifier type: ${context.type}`);
  }
}

function canonicalizeXml(xml: string): string {
  return xml.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
}

function sha256Base64(buffer: Buffer): string {
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('base64');
}

function createXmlSignature(
  content: string,
  parsedCert: ParsedCertificate,
  passphrase?: string
): { signatureValue: string; signatureMethod: string } {
  const keyObject = loadPrivateKey(parsedCert.privateKeyPem, passphrase);
  const isEc = keyObject.asymmetricKeyType === 'ec';
  const signatureMethod = isEc
    ? 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256'
    : 'http://www.w3.org/2000/09/xmldsig#rsa-sha256';

  const signatureValue = cryptoSign(
    isEc ? 'sha256' : 'RSA-SHA256',
    Buffer.from(content, 'utf8'),
    isEc ? { key: keyObject, dsaEncoding: 'der' } : { key: keyObject }
  ).toString('base64');

  return { signatureValue, signatureMethod };
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

function encodeCertificate(certificatePem: string): string {
  return certificatePem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\r?\n/g, '');
}
