import { createHash, createPrivateKey, sign as cryptoSign, X509Certificate } from 'node:crypto';
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
const XADES_NS = 'http://uri.etsi.org/01903/v1.3.2#';
const SIGNED_PROPERTIES_TYPE = 'http://uri.etsi.org/01903#SignedProperties';
const EXC_C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const ENVELOPED_SIGNATURE = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const DIGEST_SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';

export function buildSignedAuthTokenRequest(
  params: BuildAuthTokenRequestParams,
  credentials: CertificateCredentials
): string {
  const parsedCertificate = parseCertificate(credentials);
  const requestWithoutSignature = buildUnsignedAuthTokenRequest(params, true);
  const requestForDigest = buildUnsignedAuthTokenRequest(params, false);

  const signatureId = 'Signature';
  const signedPropertiesId = 'SignedProperties';

  const passphrase = credentials.privateKeyPassword ?? credentials.password;
  const { signatureMethod, signingTime, certificateDigestBase64, issuerName, serialNumberDecimal } =
    buildCertificateDetails(parsedCertificate, passphrase);

  const signedPropertiesXml = buildSignedPropertiesXml({
    signedPropertiesId,
    signingTime,
    certificateDigestBase64,
    issuerName,
    serialNumberDecimal
  });

  const signedPropertiesDigest = sha256Base64(Buffer.from(signedPropertiesXml, 'utf8'));
  const rootDigest = sha256Base64(Buffer.from(requestForDigest, 'utf8'));

  const signedInfoXml = buildSignedInfoXml({
    signatureMethod,
    rootDigest,
    signedPropertiesDigest
  });

  const signatureValue = signCanonicalSignedInfo(signedInfoXml, parsedCertificate, passphrase);
  const certificateBase64 = encodeCertificate(parsedCertificate.certificatePem);
  const qualifyingPropertiesXml = buildQualifyingPropertiesXml(signatureId, signedPropertiesXml);

  const signatureXml = `<ds:Signature xmlns:ds="${DS_NS}" Id="${signatureId}">${signedInfoXml}<ds:SignatureValue>${signatureValue}</ds:SignatureValue>${buildKeyInfoXml(certificateBase64)}<ds:Object>${qualifyingPropertiesXml}</ds:Object></ds:Signature>`;

  return requestWithoutSignature.replace('</AuthTokenRequest>', `${signatureXml}</AuthTokenRequest>`);
}

export function buildUnsignedAuthTokenRequest(
  params: BuildAuthTokenRequestParams,
  includeDsNamespace = true
): string {
  const contextXml = buildContextIdentifier(params.contextIdentifier);
  const dsNamespace = includeDsNamespace ? ` xmlns:ds="${DS_NS}"` : '';
  return `<?xml version="1.0" encoding="utf-8"?><AuthTokenRequest xmlns="${AUTH_NAMESPACE}"${dsNamespace}><Challenge>${params.challenge}</Challenge><ContextIdentifier>${contextXml}</ContextIdentifier><SubjectIdentifierType>${params.subjectIdentifierType}</SubjectIdentifierType></AuthTokenRequest>`;
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

function sha256Base64(buffer: Buffer): string {
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('base64');
}

function buildCertificateDetails(parsedCert: ParsedCertificate, passphrase?: string): {
  signatureMethod: string;
  signingTime: string;
  certificateDigestBase64: string;
  issuerName: string;
  serialNumberDecimal: string;
} {
  const x509 = new X509Certificate(parsedCert.certificatePem);
  const signatureMethod = detectSignatureMethod(parsedCert, passphrase);
  const signingTime = new Date(Date.now() - 60_000).toISOString();
  const certificateDigestBase64 = createHash('sha256').update(x509.raw).digest('base64');
  const issuerName = x509.issuer;
  const serialNumberDecimal = hexToDecimal(x509.serialNumber);

  return {
    signatureMethod,
    signingTime,
    certificateDigestBase64,
    issuerName,
    serialNumberDecimal
  };
}

function detectSignatureMethod(parsedCert: ParsedCertificate, passphrase?: string): string {
  const keyObject = loadPrivateKey(parsedCert.privateKeyPem, passphrase);
  return keyObject.asymmetricKeyType === 'ec'
    ? 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256'
    : 'http://www.w3.org/2000/09/xmldsig#rsa-sha256';
}

function buildSignedInfoXml(params: {
  signatureMethod: string;
  rootDigest: string;
  signedPropertiesDigest: string;
}): string {
  return `<ds:SignedInfo xmlns:ds="${DS_NS}"><ds:CanonicalizationMethod Algorithm="${EXC_C14N}"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="${params.signatureMethod}"></ds:SignatureMethod><ds:Reference URI=""><ds:Transforms><ds:Transform Algorithm="${ENVELOPED_SIGNATURE}"></ds:Transform><ds:Transform Algorithm="${EXC_C14N}"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="${DIGEST_SHA256}"></ds:DigestMethod><ds:DigestValue>${params.rootDigest}</ds:DigestValue></ds:Reference><ds:Reference Type="${SIGNED_PROPERTIES_TYPE}" URI="#SignedProperties"><ds:Transforms><ds:Transform Algorithm="${EXC_C14N}"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="${DIGEST_SHA256}"></ds:DigestMethod><ds:DigestValue>${params.signedPropertiesDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;
}

function buildSignedPropertiesXml(params: {
  signedPropertiesId: string;
  signingTime: string;
  certificateDigestBase64: string;
  issuerName: string;
  serialNumberDecimal: string;
}): string {
  return `<xades:SignedProperties xmlns:ds="${DS_NS}" xmlns:xades="${XADES_NS}" Id="${params.signedPropertiesId}"><xades:SignedSignatureProperties><xades:SigningTime>${params.signingTime}</xades:SigningTime><xades:SigningCertificate><xades:Cert><xades:CertDigest><ds:DigestMethod Algorithm="${DIGEST_SHA256}"></ds:DigestMethod><ds:DigestValue>${params.certificateDigestBase64}</ds:DigestValue></xades:CertDigest><xades:IssuerSerial><ds:X509IssuerName>${escapeXml(params.issuerName)}</ds:X509IssuerName><ds:X509SerialNumber>${params.serialNumberDecimal}</ds:X509SerialNumber></xades:IssuerSerial></xades:Cert></xades:SigningCertificate></xades:SignedSignatureProperties></xades:SignedProperties>`;
}

function buildQualifyingPropertiesXml(signatureId: string, signedPropertiesXml: string): string {
  return `<xades:QualifyingProperties xmlns:ds="${DS_NS}" xmlns:xades="${XADES_NS}" Target="#${signatureId}">${signedPropertiesXml}</xades:QualifyingProperties>`;
}

function buildKeyInfoXml(certificateBase64: string): string {
  return `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>${certificateBase64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>`;
}

function signCanonicalSignedInfo(
  signedInfoXml: string,
  parsedCert: ParsedCertificate,
  passphrase?: string
): string {
  const keyObject = loadPrivateKey(parsedCert.privateKeyPem, passphrase);
  const isEc = keyObject.asymmetricKeyType === 'ec';
  return cryptoSign(
    isEc ? 'sha256' : 'RSA-SHA256',
    Buffer.from(signedInfoXml, 'utf8'),
    isEc ? { key: keyObject, dsaEncoding: 'der' } : { key: keyObject }
  ).toString('base64');
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

function hexToDecimal(hexValue: string): string {
  const normalized = hexValue.replace(/[^0-9a-fA-F]/g, '');
  if (!normalized) {
    return '0';
  }
  return BigInt(`0x${normalized}`).toString(10);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/\'/g, '&apos;');
}
