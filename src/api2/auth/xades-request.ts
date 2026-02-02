import { createHash, createPrivateKey, sign as cryptoSign, randomUUID, X509Certificate } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { ExclusiveCanonicalization } from 'xml-crypto';
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
const C14N_EXC = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const ENVELOPED_SIGNATURE = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const DIGEST_SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';

export function buildSignedAuthTokenRequest(
  params: BuildAuthTokenRequestParams,
  credentials: CertificateCredentials
): string {
  const parsedCertificate = parseCertificate(credentials);
  const requestWithoutSignature = buildUnsignedAuthTokenRequest(params, false, true);
  const requestForDigest = buildUnsignedAuthTokenRequest(params, false, false);

  const idSuffix = randomUUID();
  const signatureId = `Signature_${idSuffix}`;
  const signedInfoId = `SignedInfo_${idSuffix}`;
  const signedPropertiesId = `SignedProperties_${idSuffix}`;
  const signedSignaturePropertiesId = `SignedSignatureProperties_${idSuffix}`;
  const signedDataObjectPropertiesId = `SignedDataObjectProperties_${idSuffix}`;
  const referenceId = `Reference1_${idSuffix}`;
  const signedPropertiesReferenceId = `SignedProperties-Reference_${idSuffix}`;
  const signatureValueId = `SignatureValue_${idSuffix}`;
  const keyInfoId = `KeyInfo_${idSuffix}`;
  const qualifyingPropertiesId = `QualifyingProperties_${idSuffix}`;

  const passphrase = credentials.privateKeyPassword ?? credentials.password;
  const { signatureMethod, signingTime, certificateDigestBase64, issuerName, subjectName, serialNumberDecimal } =
    buildCertificateDetails(parsedCertificate, passphrase);

  const signedPropertiesXml = buildSignedPropertiesXml({
    signedPropertiesId,
    signedSignaturePropertiesId,
    signedDataObjectPropertiesId,
    referenceId,
    signingTime,
    certificateDigestBase64,
    issuerName,
    serialNumberDecimal
  });

  // Compute SignedProperties digest using exc-c14n in document context (matching C# reference implementation).
  // The canonicalization removes redundant namespace declarations inherited from QualifyingProperties.
  const qualifyingPropertiesForDigest = buildQualifyingPropertiesXml(signatureId, qualifyingPropertiesId, signedPropertiesXml);
  const signedPropertiesDigest = computeSignedPropertiesDigest(qualifyingPropertiesForDigest, signedPropertiesId);
  const rootDigest = sha256Base64(requestForDigest);

  const signedInfoXml = buildSignedInfoXml({
    signedInfoId,
    signatureMethod,
    rootDigest,
    signedPropertiesDigest,
    referenceId,
    signedPropertiesReferenceId,
    signedPropertiesId
  });

  // Sign the raw SignedInfo string directly (matches Go implementation).
  // Since we use explicit end tags, raw string is byte-for-byte identical to canonical form.
  const signatureValue = signRawSignedInfo(signedInfoXml, parsedCertificate, passphrase);
  const certificateBase64 = encodeCertificate(parsedCertificate.certificatePem);
  const qualifyingPropertiesXml = buildQualifyingPropertiesXml(signatureId, qualifyingPropertiesId, signedPropertiesXml);

  const signatureXml = `<ds:Signature xmlns:ds="${DS_NS}" Id="${signatureId}">${signedInfoXml}<ds:SignatureValue Id="${signatureValueId}">${signatureValue}</ds:SignatureValue>${buildKeyInfoXml(certificateBase64, keyInfoId, issuerName, subjectName, serialNumberDecimal)}<ds:Object>${qualifyingPropertiesXml}</ds:Object></ds:Signature>`;

  return requestWithoutSignature.replace('</AuthTokenRequest>', `${signatureXml}</AuthTokenRequest>`);
}

export function buildUnsignedAuthTokenRequest(
  params: BuildAuthTokenRequestParams,
  includeDsNamespace = false,
  includeXmlDeclaration = true
): string {
  const contextXml = buildContextIdentifier(params.contextIdentifier);
  const dsNamespace = includeDsNamespace ? ` xmlns:ds="${DS_NS}"` : '';
  const schemaNamespaces = ` xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`;
  const xml = `<AuthTokenRequest xmlns="${AUTH_NAMESPACE}"${schemaNamespaces}${dsNamespace}><Challenge>${params.challenge}</Challenge><ContextIdentifier>${contextXml}</ContextIdentifier><SubjectIdentifierType>${params.subjectIdentifierType}</SubjectIdentifierType></AuthTokenRequest>`;
  return includeXmlDeclaration ? `<?xml version="1.0" encoding="utf-8"?>${xml}` : xml;
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

function sha256Base64(content: string | Buffer): string {
  const hash = createHash('sha256');
  hash.update(content);
  return hash.digest('base64');
}

function computeSignedPropertiesDigest(qualifyingPropertiesXml: string, _signedPropertiesId: string): string {
  // Wrap in a context that matches the final document structure.
  // This ensures exc-c14n produces the correct output with proper namespace handling.
  const contextWrapper = `<ds:Signature xmlns:ds="${DS_NS}"><ds:Object>${qualifyingPropertiesXml}</ds:Object></ds:Signature>`;
  const doc = new DOMParser().parseFromString(contextWrapper, 'application/xml');
  // Use getElementsByTagNameNS since xmldom's getElementById doesn't work without DTD
  const signedPropsElems = doc.getElementsByTagNameNS(XADES_NS, 'SignedProperties');
  const signedPropsElem = signedPropsElems?.[0];
  if (!signedPropsElem) {
    throw new Error('SignedProperties element not found for digest computation');
  }
  const c14n = new ExclusiveCanonicalization();
  const canonicalized = c14n.process(signedPropsElem);
  return sha256Base64(canonicalized);
}

function buildCertificateDetails(parsedCert: ParsedCertificate, passphrase?: string): {
  signatureMethod: string;
  signingTime: string;
  certificateDigestBase64: string;
  issuerName: string;
  subjectName: string;
  serialNumberDecimal: string;
} {
  const x509 = new X509Certificate(parsedCert.certificatePem);
  const signatureMethod = detectSignatureMethod(parsedCert, passphrase);
  const signingTime = new Date(Date.now() - 60_000).toISOString();
  const certificateDigestBase64 = createHash('sha256').update(x509.raw).digest('base64');
  const issuerName = x509.issuer;
  const subjectName = x509.subject;
  const serialNumberDecimal = toDecimalSerial(x509.serialNumber);

  return {
    signatureMethod,
    signingTime,
    certificateDigestBase64,
    issuerName,
    subjectName,
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
  signedInfoId: string;
  signatureMethod: string;
  rootDigest: string;
  signedPropertiesDigest: string;
  referenceId: string;
  signedPropertiesReferenceId: string;
  signedPropertiesId: string;
}): string {
  // IMPORTANT: Use explicit end tags (not self-closing) to match C14N canonical form.
  // This ensures raw string hash matches canonical hash, which is required for KSeF validation.
  // SignedProperties Reference includes exc-c14n Transform (matching C# reference implementation).
  return `<ds:SignedInfo xmlns:ds="${DS_NS}" Id="${params.signedInfoId}"><ds:CanonicalizationMethod Algorithm="${C14N_EXC}"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="${params.signatureMethod}"></ds:SignatureMethod><ds:Reference Id="${params.referenceId}" URI=""><ds:Transforms><ds:Transform Algorithm="${ENVELOPED_SIGNATURE}"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="${DIGEST_SHA256}"></ds:DigestMethod><ds:DigestValue>${params.rootDigest}</ds:DigestValue></ds:Reference><ds:Reference Id="${params.signedPropertiesReferenceId}" Type="${SIGNED_PROPERTIES_TYPE}" URI="#${params.signedPropertiesId}"><ds:Transforms><ds:Transform Algorithm="${C14N_EXC}"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="${DIGEST_SHA256}"></ds:DigestMethod><ds:DigestValue>${params.signedPropertiesDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;
}

function buildSignedPropertiesXml(params: {
  signedPropertiesId: string;
  signedSignaturePropertiesId: string;
  signedDataObjectPropertiesId: string;
  referenceId: string;
  signingTime: string;
  certificateDigestBase64: string;
  issuerName: string;
  serialNumberDecimal: string;
}): string {
  // IMPORTANT: Use explicit end tags (not self-closing) to match C14N canonical form.
  return `<xades:SignedProperties xmlns="${AUTH_NAMESPACE}" xmlns:ds="${DS_NS}" xmlns:xades="${XADES_NS}" Id="${params.signedPropertiesId}"><xades:SignedSignatureProperties Id="${params.signedSignaturePropertiesId}"><xades:SigningTime>${params.signingTime}</xades:SigningTime><xades:SigningCertificate><xades:Cert><xades:CertDigest><ds:DigestMethod Algorithm="${DIGEST_SHA256}"></ds:DigestMethod><ds:DigestValue>${params.certificateDigestBase64}</ds:DigestValue></xades:CertDigest><xades:IssuerSerial><ds:X509IssuerName>${params.issuerName}</ds:X509IssuerName><ds:X509SerialNumber>${params.serialNumberDecimal}</ds:X509SerialNumber></xades:IssuerSerial></xades:Cert></xades:SigningCertificate></xades:SignedSignatureProperties><xades:SignedDataObjectProperties Id="${params.signedDataObjectPropertiesId}"><xades:DataObjectFormat ObjectReference="#${params.referenceId}"><xades:MimeType>text/xml</xades:MimeType></xades:DataObjectFormat></xades:SignedDataObjectProperties></xades:SignedProperties>`;
}

function buildQualifyingPropertiesXml(signatureId: string, qualifyingPropertiesId: string, signedPropertiesXml: string): string {
  return `<xades:QualifyingProperties xmlns:ds="${DS_NS}" xmlns:xades="${XADES_NS}" Id="${qualifyingPropertiesId}" Target="#${signatureId}">${signedPropertiesXml}</xades:QualifyingProperties>`;
}

function buildKeyInfoXml(
  certificateBase64: string,
  keyInfoId: string,
  issuerName: string,
  subjectName: string,
  serialNumberDecimal: string
): string {
  return `<ds:KeyInfo Id="${keyInfoId}"><ds:X509Data><ds:X509IssuerSerial><ds:X509IssuerName>${issuerName}</ds:X509IssuerName><ds:X509SerialNumber>${serialNumberDecimal}</ds:X509SerialNumber></ds:X509IssuerSerial><ds:X509SubjectName>${subjectName}</ds:X509SubjectName><ds:X509Certificate>${certificateBase64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>`;
}

function signRawSignedInfo(
  signedInfoXml: string,
  parsedCert: ParsedCertificate,
  passphrase?: string
): string {
  const keyObject = loadPrivateKey(parsedCert.privateKeyPem, passphrase);
  const isEc = keyObject.asymmetricKeyType === 'ec';
  // Sign the raw XML string directly (crypto.sign handles hashing internally).
  // For ECDSA, use ieee-p1363 encoding (r||s concatenation) as required by KSeF.
  return cryptoSign(
    isEc ? 'sha256' : 'RSA-SHA256',
    Buffer.from(signedInfoXml, 'utf8'),
    isEc ? { key: keyObject, dsaEncoding: 'ieee-p1363' } : { key: keyObject }
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

function toDecimalSerial(serialNumber: string): string {
  const cleaned = serialNumber.replace(/[^0-9a-fA-F]/g, '');
  if (!cleaned) {
    return serialNumber;
  }
  try {
    return BigInt(`0x${cleaned}`).toString(10);
  } catch {
    return serialNumber;
  }
}
