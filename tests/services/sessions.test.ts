import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { SessionV2Service, BatchSessionUploader } from '../../src/api2/services/sessions.js';
import { createMockHttpClient, createMockSecurityService } from '../helpers/mock-http-client.js';
import type { SymmetricKeyMaterial } from '../../src/api2/crypto/symmetric.js';

function createTestMaterial(): SymmetricKeyMaterial {
  return {
    symmetricKey: randomBytes(32),
    initializationVector: randomBytes(16),
    encryptedSymmetricKey: 'encrypted-key-base64',
    initializationVectorBase64: 'iv-base64'
  };
}

describe('SessionV2Service', () => {
  const mockHttpClient = createMockHttpClient();
  const mockSecurityService = createMockSecurityService();

  beforeEach(() => {
    mockHttpClient.reset();
    vi.clearAllMocks();
  });

  describe('openOnlineSession', () => {
    const formCode = { systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' } as const;

    it('calls POST /sessions/online with correct body', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'session-ref-123',
        status: 'Active'
      });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      const material = createTestMaterial();
      await service.openOnlineSession('access-token', formCode, { encryptionMaterial: material });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/sessions/online');
      expect(request?.headers?.['Authorization']).toBe('Bearer access-token');

      const body = JSON.parse(request?.body!);
      expect(body.formCode).toEqual(formCode);
      expect(body.encryption.encryptedSymmetricKey).toBe('encrypted-key-base64');
      expect(body.encryption.initializationVector).toBe('iv-base64');
    });

    it('uses provided encryption material', async () => {
      mockHttpClient.mockResponse({ referenceNumber: 'ref-123' });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      const material = createTestMaterial();
      const result = await service.openOnlineSession('token', formCode, { encryptionMaterial: material });

      expect(result.encryptionMaterial).toBe(material);
    });

    it('adds X-KSeF-Feature header when upoVersion specified', async () => {
      mockHttpClient.mockResponse({ referenceNumber: 'ref-123' });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.openOnlineSession('token', formCode, {
        encryptionMaterial: createTestMaterial(),
        upoVersion: 'upo-v4-3'
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.headers?.['X-KSeF-Feature']).toBe('upo-v4-3');
    });

    it('returns session with encryption material', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'session-123',
        status: 'Active'
      });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      const material = createTestMaterial();
      const result = await service.openOnlineSession('token', formCode, { encryptionMaterial: material });

      expect(result.referenceNumber).toBe('session-123');
      expect(result.encryptionMaterial).toBeDefined();
      expect(result.encryptionMaterial.symmetricKey).toBeInstanceOf(Buffer);
    });
  });

  describe('closeOnlineSession', () => {
    it('calls POST /sessions/online/{ref}/close', async () => {
      mockHttpClient.mockResponse({});

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.closeOnlineSession('access-token', 'session-ref-123');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/sessions/online/session-ref-123/close');
      expect(request?.headers?.['Authorization']).toBe('Bearer access-token');
    });
  });

  describe('openBatchSession', () => {
    it('calls POST /sessions/batch with batch file info', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'batch-ref-123',
        partUploadRequests: []
      });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      const batchFile = {
        fileSize: 1000,
        fileHash: 'hash-base64',
        fileParts: [{ ordinalNumber: 1, fileSize: 1000, fileHash: 'part-hash' }]
      };
      const formCode = { systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' } as const;

      await service.openBatchSession('token', batchFile, formCode, {
        encryptionMaterial: createTestMaterial()
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/sessions/batch');
      
      const body = JSON.parse(request?.body!);
      expect(body.batchFile).toEqual(batchFile);
      expect(body.formCode).toEqual(formCode);
    });
  });

  describe('closeBatchSession', () => {
    it('calls POST /sessions/batch/{ref}/close', async () => {
      mockHttpClient.mockResponse({});

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.closeBatchSession('token', 'batch-ref');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/sessions/batch/batch-ref/close');
    });
  });

  describe('getSessionStatus', () => {
    it('calls GET /sessions/{ref}', async () => {
      mockHttpClient.mockResponse({
        status: 'Active',
        invoiceCount: 5
      });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      const result = await service.getSessionStatus('token', 'session-ref');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/sessions/session-ref');
      expect(result.status).toBe('Active');
      expect(result.invoiceCount).toBe(5);
    });
  });

  describe('listSessions', () => {
    it('calls GET /sessions with required sessionType', async () => {
      mockHttpClient.mockResponse({
        sessions: [],
        continuationToken: null
      });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.listSessions('token', { sessionType: 'Online' });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/sessions');
      expect(request?.url).toContain('sessionType=Online');
    });

    it('includes filters and continuation token when provided', async () => {
      mockHttpClient.mockResponse({ sessions: [] });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.listSessions('token', {
        sessionType: 'Batch',
        referenceNumber: 'sess-123',
        statuses: ['InProgress', 'Succeeded'],
        pageSize: 50,
        continuationToken: 'cont-123'
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('sessionType=Batch');
      expect(request?.url).toContain('referenceNumber=sess-123');
      expect(request?.url).toContain('statuses=InProgress');
      expect(request?.url).toContain('statuses=Succeeded');
      expect(request?.url).toContain('pageSize=50');
      expect(request?.headers?.['x-continuation-token']).toBe('cont-123');
    });
  });

  describe('listSessionInvoices', () => {
    it('calls GET /sessions/{ref}/invoices', async () => {
      mockHttpClient.mockResponse({
        invoices: [],
        continuationToken: null
      });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.listSessionInvoices('token', 'session-ref');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/sessions/session-ref/invoices');
    });

    it('includes continuation token header when provided', async () => {
      mockHttpClient.mockResponse({ invoices: [] });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.listSessionInvoices('token', 'session-ref', {
        continuationToken: 'cont-token-123'
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.headers?.['x-continuation-token']).toBe('cont-token-123');
    });

    it('includes pageSize query param', async () => {
      mockHttpClient.mockResponse({ invoices: [] });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.listSessionInvoices('token', 'session-ref', { pageSize: 50 });

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('pageSize=50');
    });
  });

  describe('listFailedSessionInvoices', () => {
    it('calls GET /sessions/{ref}/invoices/failed', async () => {
      mockHttpClient.mockResponse({ invoices: [] });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.listFailedSessionInvoices('token', 'session-ref');

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('/sessions/session-ref/invoices/failed');
    });
  });

  describe('getInvoiceStatus', () => {
    it('calls GET /sessions/{ref}/invoices/{invoiceRef}', async () => {
      mockHttpClient.mockResponse({
        ordinalNumber: 1,
        status: 'Accepted'
      });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      const result = await service.getInvoiceStatus('token', 'session-ref', 'invoice-ref');

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('/sessions/session-ref/invoices/invoice-ref');
      expect(result.status).toBe('Accepted');
    });
  });

  describe('downloadInvoiceUpoByKsef', () => {
    it('returns XML from UPO endpoint', async () => {
      const upoXml = '<UPO><Status>OK</Status></UPO>';
      mockHttpClient.mockResponse(upoXml, {
        headers: { 'x-ms-meta-hash': 'upo-hash-value' }
      });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      const result = await service.downloadInvoiceUpoByKsef('token', 'session-ref', 'ksef-123');

      expect(result).toBe(upoXml);
    });
  });

  describe('downloadInvoiceUpoByKsefWithHash', () => {
    it('extracts hash from response header', async () => {
      const upoXml = '<UPO/>';
      mockHttpClient.mockResponse(upoXml, {
        headers: { 'x-ms-meta-hash': 'hash-from-header' }
      });

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      const result = await service.downloadInvoiceUpoByKsefWithHash('token', 'session-ref', 'ksef-123');

      expect(result.xml).toBe(upoXml);
      expect(result.hash).toBe('hash-from-header');
    });
  });

  describe('downloadSessionUpo', () => {
    it('calls correct endpoint for session UPO', async () => {
      mockHttpClient.mockResponse('<SessionUPO/>');

      const service = new SessionV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.downloadSessionUpo('token', 'session-ref', 'upo-ref');

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('/sessions/session-ref/upo/upo-ref');
    });
  });
});

describe('BatchSessionUploader', () => {
  describe('uploadPart', () => {
    it('uploads part to presigned URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });
      vi.stubGlobal('fetch', mockFetch);

      const uploader = new BatchSessionUploader();
      const uploadRequest = {
        url: 'https://storage.example.com/upload?sig=xyz',
        method: 'PUT' as const,
        headers: { 'Content-Type': 'application/octet-stream' },
        ordinalNumber: 1
      };
      const payload = Buffer.from('test payload');

      await uploader.uploadPart(uploadRequest, payload);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://storage.example.com/upload?sig=xyz',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: new Uint8Array(payload)
        }
      );

      vi.unstubAllGlobals();
    });

    it('throws on upload failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });
      vi.stubGlobal('fetch', mockFetch);

      const uploader = new BatchSessionUploader();
      const uploadRequest = {
        url: 'https://storage.example.com/upload',
        method: 'PUT' as const,
        headers: {},
        ordinalNumber: 2
      };

      await expect(uploader.uploadPart(uploadRequest, Buffer.from('data'))).rejects.toThrow(
        /Failed to upload batch part #2/
      );

      vi.unstubAllGlobals();
    });
  });
});
