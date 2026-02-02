import { describe, it, expect } from 'vitest';
import * as forge from 'node-forge';
import { buildSignedAuthTokenRequest } from '../../src/api2/auth/xades-request.js';
import type { CertificateCredentials } from '../../src/types/auth.js';

// Generate a test certificate and private key
function generateTestCredentials(): CertificateCredentials {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  
  const attrs = [
    { name: 'commonName', value: 'Test Certificate' },
    { name: 'countryName', value: 'PL' },
    { name: 'organizationName', value: 'Test Org' }
  ];
  
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);

  // Export to PKCS#12
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, 'test-password');
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Buffer = Buffer.from(p12Der, 'binary');

  return {
    certificate: p12Buffer,
    password: 'test-password'
  };
}

describe('buildSignedAuthTokenRequest', () => {
  const credentials = generateTestCredentials();

  it('builds valid XML structure', () => {
    const result = buildSignedAuthTokenRequest(
      {
        challenge: 'test-challenge-123',
        contextIdentifier: { type: 'Nip', value: '1234567890' },
        subjectIdentifierType: 'certificateSubject'
      },
      credentials
    );

    expect(result).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(result).toContain('<AuthTokenRequest');
    expect(result).toContain('</AuthTokenRequest>');
  });

  it('includes challenge in request', () => {
    const result = buildSignedAuthTokenRequest(
      {
        challenge: 'unique-challenge-value',
        contextIdentifier: { type: 'Nip', value: '1234567890' },
        subjectIdentifierType: 'certificateSubject'
      },
      credentials
    );

    expect(result).toContain('<Challenge>unique-challenge-value</Challenge>');
  });

  it('includes Nip context identifier', () => {
    const result = buildSignedAuthTokenRequest(
      {
        challenge: 'test',
        contextIdentifier: { type: 'Nip', value: '9876543210' },
        subjectIdentifierType: 'certificateSubject'
      },
      credentials
    );

    expect(result).toContain('<Nip>9876543210</Nip>');
  });

  it('includes InternalId context identifier', () => {
    const result = buildSignedAuthTokenRequest(
      {
        challenge: 'test',
        contextIdentifier: { type: 'InternalId', value: '1234567890-12345' },
        subjectIdentifierType: 'certificateSubject'
      },
      credentials
    );

    expect(result).toContain('<InternalId>1234567890-12345</InternalId>');
  });

  it('includes NipVatUe context identifier', () => {
    const result = buildSignedAuthTokenRequest(
      {
        challenge: 'test',
        contextIdentifier: { type: 'NipVatUe', value: '1234567890-DE123456789' },
        subjectIdentifierType: 'certificateSubject'
      },
      credentials
    );

    expect(result).toContain('<NipVatUe>1234567890-DE123456789</NipVatUe>');
  });

  it('includes PeppolId context identifier', () => {
    const result = buildSignedAuthTokenRequest(
      {
        challenge: 'test',
        contextIdentifier: { type: 'PeppolId', value: 'PPL1234567890' },
        subjectIdentifierType: 'certificateSubject'
      },
      credentials
    );

    expect(result).toContain('<PeppolId>PPL1234567890</PeppolId>');
  });

  it('includes subject identifier type', () => {
    const result = buildSignedAuthTokenRequest(
      {
        challenge: 'test',
        contextIdentifier: { type: 'Nip', value: '1234567890' },
        subjectIdentifierType: 'certificateFingerprint'
      },
      credentials
    );

    expect(result).toContain('<SubjectIdentifierType>certificateFingerprint</SubjectIdentifierType>');
  });

  it('creates valid XML signature', () => {
    const result = buildSignedAuthTokenRequest(
      {
        challenge: 'test',
        contextIdentifier: { type: 'Nip', value: '1234567890' },
        subjectIdentifierType: 'certificateSubject'
      },
      credentials
    );

    expect(result).toContain('<ds:Signature');
    expect(result).toContain('<ds:SignedInfo>');
    expect(result).toContain('<ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha256">');
    expect(result).toContain('<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256">');
    expect(result).toContain('<ds:DigestValue>');
    expect(result).toContain('<ds:SignatureValue>');
    expect(result).toContain('<ds:X509Certificate>');
  });

  it('includes correct namespaces', () => {
    const result = buildSignedAuthTokenRequest(
      {
        challenge: 'test',
        contextIdentifier: { type: 'Nip', value: '1234567890' },
        subjectIdentifierType: 'certificateSubject'
      },
      credentials
    );

    expect(result).toContain('xmlns="http://ksef.mf.gov.pl/auth/token/2.0"');
    expect(result).toContain('xmlns:ds="http://www.w3.org/2000/09/xmldsig#"');
  });

  it('generates base64-encoded signature value', () => {
    const result = buildSignedAuthTokenRequest(
      {
        challenge: 'test',
        contextIdentifier: { type: 'Nip', value: '1234567890' },
        subjectIdentifierType: 'certificateSubject'
      },
      credentials
    );

    // Extract signature value
    const signatureMatch = result.match(/<ds:SignatureValue>([^<]+)<\/ds:SignatureValue>/);
    expect(signatureMatch).not.toBeNull();
    
    const signatureValue = signatureMatch![1];
    // Verify it's valid base64
    expect(signatureValue).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('generates base64-encoded certificate', () => {
    const result = buildSignedAuthTokenRequest(
      {
        challenge: 'test',
        contextIdentifier: { type: 'Nip', value: '1234567890' },
        subjectIdentifierType: 'certificateSubject'
      },
      credentials
    );

    // Extract certificate
    const certMatch = result.match(/<ds:X509Certificate>([^<]+)<\/ds:X509Certificate>/);
    expect(certMatch).not.toBeNull();
    
    const certValue = certMatch![1];
    // Verify it's valid base64 (may contain whitespace from formatting)
    expect(certValue.replace(/\s/g, '')).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('produces different signatures for different challenges', () => {
    const result1 = buildSignedAuthTokenRequest(
      {
        challenge: 'challenge-1',
        contextIdentifier: { type: 'Nip', value: '1234567890' },
        subjectIdentifierType: 'certificateSubject'
      },
      credentials
    );

    const result2 = buildSignedAuthTokenRequest(
      {
        challenge: 'challenge-2',
        contextIdentifier: { type: 'Nip', value: '1234567890' },
        subjectIdentifierType: 'certificateSubject'
      },
      credentials
    );

    const sig1 = result1.match(/<ds:SignatureValue>([^<]+)<\/ds:SignatureValue>/)![1];
    const sig2 = result2.match(/<ds:SignatureValue>([^<]+)<\/ds:SignatureValue>/)![1];

    expect(sig1).not.toBe(sig2);
  });
});
