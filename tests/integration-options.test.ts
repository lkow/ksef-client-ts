import { describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  AuthenticationV2Service, SessionV2Service, SecurityService, KsefApiV2Client,
  buildUnsignedAuthTokenRequest, SymmetricKeyManager
} from '../src/index.js';
import { createMockHttpClient, createMockSecurityService } from './helpers/mock-http-client.js';

const policy = { allowedIps: {
  ip4Addresses: ['192.0.2.1'], ip4Ranges: ['192.0.2.10-192.0.2.20'], ip4Masks: ['198.51.100.0/24']
} };
const formCode = { systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' };
const material = {
  symmetricKey: randomBytes(32), initializationVector: randomBytes(16),
  encryptedSymmetricKey: 'fixture', initializationVectorBase64: 'fixture-iv', publicKeyId: 'key-id'
};

describe('TR authentication and offline options', () => {
  it('sends the authorization policy unchanged in token auth', async () => {
    const http = createMockHttpClient();
    http.mockResponseOnce({ challenge: 'fixture', timestampMs: 1, clientIp: '192.0.2.1' });
    const service = new AuthenticationV2Service(http as any, 'demo', createMockSecurityService() as any);
    await service.initiateTokenAuthentication({ type: 'Nip', value: '1111111111' }, 'fixture', { authorizationPolicy: policy });
    const body = JSON.parse(http.getLastRequest()!.body!);
    expect(body.authorizationPolicy).toEqual(policy);
    expect(body).not.toHaveProperty('ipAddressPolicy');
    expect(body.publicKeyId).toBe('test-key-id');
  });

  it('maps legacy STRICT to the actual challenge IPv4 address', async () => {
    const http = createMockHttpClient();
    http.mockResponseOnce({ challenge: 'fixture', timestampMs: 1, clientIp: '192.0.2.9' });
    const service = new AuthenticationV2Service(http as any, 'demo', createMockSecurityService() as any);
    await service.initiateTokenAuthentication({ type: 'Nip', value: '1111111111' }, 'fixture', { ipAddressPolicy: 'STRICT' });
    const body = JSON.parse(http.getLastRequest()!.body!);
    expect(body.authorizationPolicy).toEqual({ allowedIps: { ip4Addresses: ['192.0.2.9'] } });
    expect(body).not.toHaveProperty('ipAddressPolicy');
  });

  it.each([undefined, '::1'])('does not silently weaken STRICT when the challenge IP is %s', async (clientIp) => {
    const http = createMockHttpClient();
    http.mockResponseOnce({ challenge: 'fixture', timestampMs: 1, clientIp });
    const service = new AuthenticationV2Service(http as any, 'demo', createMockSecurityService() as any);
    await expect(service.initiateTokenAuthentication({ type: 'Nip', value: '1111111111' }, 'fixture', { ipAddressPolicy: 'STRICT' })).rejects.toThrow(/IPv4/);
    expect(http.getRequests()).toHaveLength(1);
  });

  it('rejects conflicting legacy and explicit policies', async () => {
    const http = createMockHttpClient();
    const service = new AuthenticationV2Service(http as any, 'demo', createMockSecurityService() as any);
    await expect(service.initiateTokenAuthentication({ type: 'Nip', value: '1111111111' }, 'fixture', {
      authorizationPolicy: policy, ipAddressPolicy: 'NONE'
    })).rejects.toThrow(/both/);
    expect(http.getRequests()).toHaveLength(0);
  });

  it('builds XAdES policy in schema order without changing its namespace', () => {
    const xml = buildUnsignedAuthTokenRequest({ challenge: 'fixture', contextIdentifier: { type: 'Nip', value: '1111111111' },
      subjectIdentifierType: 'certificateSubject', authorizationPolicy: policy });
    expect(xml).toContain('http://ksef.mf.gov.pl/auth/token/2.0');
    expect(xml).toContain('<SubjectIdentifierType>certificateSubject</SubjectIdentifierType><AuthorizationPolicy><AllowedIps><Ip4Address>192.0.2.1</Ip4Address><Ip4Range>192.0.2.10-192.0.2.20</Ip4Range><Ip4Mask>198.51.100.0/24</Ip4Mask></AllowedIps></AuthorizationPolicy>');
  });

  it('does not allow policy values to insert XML markup', () => {
    expect(() => buildUnsignedAuthTokenRequest({ challenge: 'fixture', contextIdentifier: { type: 'Nip', value: '1111111111' },
      subjectIdentifierType: 'certificateSubject', authorizationPolicy: { allowedIps: { ip4Addresses: ['</Ip4Address><Injected/>'] } } })).toThrow(/IPv4/);
  });

  it('keeps the key ID paired with the cached public key', async () => {
    const http = createMockHttpClient();
    http.mockResponse([{ certificate: 'Zml4dHVyZQ==', publicKeyId: 'paired-id', validFrom: '2020-01-01T00:00:00Z',
      validTo: '2099-01-01T00:00:00Z', usage: ['KsefTokenEncryption'] }]);
    const service = new SecurityService(http as any, 'demo');
    const first = await service.getPublicKeyInfo('KsefTokenEncryption');
    expect(first.publicKeyId).toBe('paired-id');
    expect(await service.getPublicKey('KsefTokenEncryption')).toBe(first.pem);
    expect(http.getRequests()).toHaveLength(1);
  });

  it.each([true, false, undefined])('forwards explicit offlineMode %s without default coercion', async (offlineMode) => {
    const http = createMockHttpClient();
    const service = new SessionV2Service(http as any, 'demo');
    await service.openBatchSession('fixture', { fileSize: 1, fileHash: 'fixture', fileParts: [] }, formCode,
      { encryptionMaterial: material, ...(offlineMode === undefined ? {} : { offlineMode }) });
    const body = JSON.parse(http.getLastRequest()!.body!);
    if (offlineMode === undefined) expect(body).not.toHaveProperty('offlineMode');
    else expect(body.offlineMode).toBe(offlineMode);
    expect(body.encryption.publicKeyId).toBe('key-id');
  });

  it('keeps offlineMode through the public batch helper', async () => {
    const client = new KsefApiV2Client({ environment: 'demo', httpClient: createMockHttpClient() as any });
    const open = vi.spyOn(client.sessions, 'openBatchSession').mockResolvedValue({ referenceNumber: 'fixture', partUploadRequests: [], encryptionMaterial: material });
    await client.createBatchSession('fixture', formCode, Buffer.from('fixture'), { session: { offlineMode: true, encryptionMaterial: material } });
    expect(open.mock.calls[0]![3]?.offlineMode).toBe(true);
  });
  it.each([
    { allowedIps: { ip4Addresses: ['256.0.0.1'] } },
    { allowedIps: { ip4Ranges: ['192.0.2.9-192.0.2.1'] } },
    { allowedIps: { ip4Masks: ['192.0.2.1/33'] } },
    { allowedIps: { ip4Addresses: Array(11).fill('192.0.2.1') } }
  ])('rejects malformed IP policies before requesting a challenge', async (authorizationPolicy) => {
    const http = createMockHttpClient();
    const service = new AuthenticationV2Service(http as any, 'demo', createMockSecurityService() as any);
    await expect(service.initiateTokenAuthentication({ type: 'Nip', value: '1111111111' }, 'fixture', { authorizationPolicy })).rejects.toThrow(/IPv4/);
    expect(http.getRequests()).toHaveLength(0);
  });

  it('does not send the obsolete NONE field or invent an authorization policy', async () => {
    const http = createMockHttpClient();
    http.mockResponseOnce({ challenge: 'fixture', timestampMs: 1 });
    const service = new AuthenticationV2Service(http as any, 'demo', createMockSecurityService() as any);
    await service.initiateTokenAuthentication({ type: 'Nip', value: '1111111111' }, 'fixture', { ipAddressPolicy: 'NONE' });
    const body = JSON.parse(http.getLastRequest()!.body!);
    expect(body).not.toHaveProperty('ipAddressPolicy');
    expect(body).not.toHaveProperty('authorizationPolicy');
  });

  it('passes policy options through public certificate authentication into the signed XML', async () => {
    const client = new KsefApiV2Client({ environment: 'demo', httpClient: createMockHttpClient() as any });
    const authenticate = vi.spyOn(client.authentication, 'initiateXadesAuthenticationWithCertificate').mockResolvedValue({} as any);
    const credentials = { certificate: 'fixture', password: 'fixture' };
    const context = { type: 'Nip', value: '1111111111' };
    await client.authenticateWithCertificate(credentials, context, { authorizationPolicy: policy, verifyCertificateChain: true });
    expect(authenticate).toHaveBeenCalledWith(credentials, context, undefined, { authorizationPolicy: policy, verifyCertificateChain: true });
  });

  it('rejects unrecognised legacy policy values instead of dropping the restriction', async () => {
    const http = createMockHttpClient();
    const service = new AuthenticationV2Service(http as any, 'demo', createMockSecurityService() as any);
    await expect(service.initiateTokenAuthentication({ type: 'Nip', value: '1111111111' }, 'fixture', { ipAddressPolicy: 'strict' as any })).rejects.toThrow(/ipAddressPolicy/);
    expect(http.getRequests()).toHaveLength(0);
  });

  it('validates certificate policy before issuing any challenge', async () => {
    const http = createMockHttpClient();
    const service = new AuthenticationV2Service(http as any, 'demo');
    await expect(service.initiateXadesAuthenticationWithCertificate({ certificate: 'fixture' }, { type: 'Nip', value: '1111111111' }, undefined,
      { authorizationPolicy: { allowedIps: { ip4Addresses: ['invalid'] } } })).rejects.toThrow(/IPv4/);
    expect(http.getRequests()).toHaveLength(0);
  });

  it.each([{}, { allowedIps: null }, { allowedIps: {} }, { allowedIps: { ip4Addresses: [] } }])('rejects empty IP restrictions on both wire formats', async (authorizationPolicy) => {
    const http = createMockHttpClient();
    const service = new AuthenticationV2Service(http as any, 'demo', createMockSecurityService() as any);
    await expect(service.initiateTokenAuthentication({ type: 'Nip', value: '1111111111' }, 'fixture', { authorizationPolicy })).rejects.toThrow(/IPv4/);
    expect(() => buildUnsignedAuthTokenRequest({ challenge: 'fixture', contextIdentifier: { type: 'Nip', value: '1111111111' },
      subjectIdentifierType: 'certificateSubject', authorizationPolicy })).toThrow(/IPv4/);
  });

  it('respects a legacy subclass that pins getPublicKey', async () => {
    const http = createMockHttpClient();
    class PinnedSecurity extends SecurityService {
      override async getPublicKey(): Promise<string> { return 'pinned-key'; }
    }
    const service = new PinnedSecurity(http as any, 'demo');
    expect(await service.getPublicKeyInfo('KsefTokenEncryption')).toEqual({ pem: 'pinned-key' });
    expect(http.getRequests()).toHaveLength(0);
  });

  it('accepts a legacy injected key provider and omits an unknown key ID', async () => {
    const http = createMockHttpClient();
    http.mockResponseOnce({ challenge: 'fixture', timestampMs: 1 });
    const service = new AuthenticationV2Service(http as any, 'demo', {
      getPublicKey: createMockSecurityService().getPublicKey
    } as any);
    await service.initiateTokenAuthentication({ type: 'Nip', value: '1111111111' }, 'fixture');
    expect(JSON.parse(http.getLastRequest()!.body!)).not.toHaveProperty('publicKeyId');
  });

  it('preserves auth options through the public token helper', async () => {
    const client = new KsefApiV2Client({ environment: 'demo', httpClient: createMockHttpClient() as any });
    const authenticate = vi.spyOn(client.authentication, 'initiateTokenAuthentication').mockResolvedValue({} as any);
    const context = { type: 'Nip', value: '1111111111' };
    await client.authenticateWithToken({ token: 'fixture' }, context, { authorizationPolicy: policy });
    expect(authenticate).toHaveBeenCalledWith(context, 'fixture', { authorizationPolicy: policy });
  });

  it('forwards offlineMode through batch.prepare and batch.submit', async () => {
    const http = createMockHttpClient();
    const client = new KsefApiV2Client({ environment: 'demo', httpClient: http as any });
    const prepared = await client.batch.prepare({ formCode, encryptionMaterial: material,
      invoices: [{ localId: 'fixture', fileName: 'invoice.xml', xml: '<fixture/>' }] });
    http.mockResponse({ referenceNumber: 'fixture', partUploadRequests: prepared.encryptedParts.map((_, i) => ({
      ordinalNumber: i + 1, url: 'https://example.invalid/fixture', method: 'PUT', headers: {}
    })) });
    vi.spyOn(client.batchUploader, 'uploadPart').mockResolvedValue(undefined);
    await client.batch.submit('fixture', prepared, { session: { offlineMode: true }, closeSession: false });
    expect(JSON.parse(http.getLastRequest()!.body!).offlineMode).toBe(true);
  });

  it('keeps legacy symmetric-key providers working without inventing key IDs', async () => {
    const manager = new SymmetricKeyManager({ getPublicKey: createMockSecurityService().getPublicKey } as any);
    const result = await manager.createMaterial();
    expect(result.symmetricKey.byteLength).toBe(32);
    expect(result).not.toHaveProperty('publicKeyId');
  });

});
