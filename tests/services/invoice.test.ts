import { describe, it, expect, beforeEach } from 'vitest';
import { InvoiceV2Service } from '../../src/api2/services/invoice.js';
import { createMockHttpClient } from '../helpers/mock-http-client.js';
import type { EncryptedInvoicePayload } from '../../src/api2/crypto/encryption.js';

describe('InvoiceV2Service', () => {
  const mockHttpClient = createMockHttpClient();

  beforeEach(() => {
    mockHttpClient.reset();
  });

  describe('sendInvoice', () => {
    it('calls POST /sessions/online/{ref}/invoices', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'invoice-ref-123',
        status: 'Pending'
      });

      const service = new InvoiceV2Service(mockHttpClient as any, 'test');

      const payload: EncryptedInvoicePayload = {
        invoiceHash: 'invoice-hash-base64',
        invoiceSize: 1000,
        encryptedInvoiceHash: 'encrypted-hash-base64',
        encryptedInvoiceSize: 1100,
        encryptedInvoiceContent: 'encrypted-content-base64',
        offlineMode: false,
        hashOfCorrectedInvoice: null
      };

      await service.sendInvoice('access-token', 'session-ref', payload);

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/sessions/online/session-ref/invoices');
      expect(request?.headers?.['Authorization']).toBe('Bearer access-token');
    });

    it('sends encrypted payload in body', async () => {
      mockHttpClient.mockResponse({ referenceNumber: 'inv-ref' });

      const service = new InvoiceV2Service(mockHttpClient as any, 'test');

      const payload: EncryptedInvoicePayload = {
        invoiceHash: 'hash1',
        invoiceSize: 500,
        encryptedInvoiceHash: 'hash2',
        encryptedInvoiceSize: 600,
        encryptedInvoiceContent: 'base64content',
        offlineMode: true,
        hashOfCorrectedInvoice: 'correction-hash'
      };

      await service.sendInvoice('token', 'session', payload);

      const request = mockHttpClient.getLastRequest();
      const body = JSON.parse(request?.body!);
      expect(body.invoiceHash).toBe('hash1');
      expect(body.invoiceSize).toBe(500);
      expect(body.encryptedInvoiceHash).toBe('hash2');
      expect(body.encryptedInvoiceContent).toBe('base64content');
      expect(body.offlineMode).toBe(true);
      expect(body.hashOfCorrectedInvoice).toBe('correction-hash');
    });

    it('returns send invoice response', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'invoice-ref-456',
        status: 'Accepted'
      });

      const service = new InvoiceV2Service(mockHttpClient as any, 'test');

      const result = await service.sendInvoice('token', 'session', {
        invoiceHash: 'h',
        invoiceSize: 1,
        encryptedInvoiceHash: 'eh',
        encryptedInvoiceSize: 2,
        encryptedInvoiceContent: 'c',
        offlineMode: false,
        hashOfCorrectedInvoice: null
      });

      expect(result.referenceNumber).toBe('invoice-ref-456');
    });
  });

  describe('queryMetadata', () => {
    it('calls POST /invoices/query/metadata', async () => {
      mockHttpClient.mockResponse({
        invoices: [],
        totalCount: 0
      });

      const service = new InvoiceV2Service(mockHttpClient as any, 'test');

      await service.queryMetadata('token', {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31'
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/invoices/query/metadata');
    });

    it('includes pagination params in query string', async () => {
      mockHttpClient.mockResponse({ invoices: [] });

      const service = new InvoiceV2Service(mockHttpClient as any, 'test');

      await service.queryMetadata(
        'token',
        { dateFrom: '2024-01-01' },
        { pageOffset: 10, pageSize: 25, sortOrder: 'Descending' }
      );

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('pageOffset=10');
      expect(request?.url).toContain('pageSize=25');
      expect(request?.url).toContain('sortOrder=Descending');
    });

    it('sends filter in request body', async () => {
      mockHttpClient.mockResponse({ invoices: [] });

      const service = new InvoiceV2Service(mockHttpClient as any, 'test');

      const filters = {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        ksefNumber: 'KSEF-123'
      };

      await service.queryMetadata('token', filters);

      const request = mockHttpClient.getLastRequest();
      const body = JSON.parse(request?.body!);
      expect(body.dateFrom).toBe('2024-01-01');
      expect(body.dateTo).toBe('2024-12-31');
      expect(body.ksefNumber).toBe('KSEF-123');
    });
  });

  describe('exportInvoices', () => {
    it('calls POST /invoices/exports', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'export-ref-123'
      });

      const service = new InvoiceV2Service(mockHttpClient as any, 'test');

      await service.exportInvoices('token', {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31'
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/invoices/exports');
      expect(request?.headers?.['Authorization']).toBe('Bearer token');
    });

    it('sends export request body', async () => {
      mockHttpClient.mockResponse({ referenceNumber: 'exp-ref' });

      const service = new InvoiceV2Service(mockHttpClient as any, 'test');

      const exportRequest = {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        invoiceTypes: ['Sales', 'Purchase']
      };

      await service.exportInvoices('token', exportRequest as any);

      const request = mockHttpClient.getLastRequest();
      const body = JSON.parse(request?.body!);
      expect(body.dateFrom).toBe('2024-01-01');
      expect(body.invoiceTypes).toEqual(['Sales', 'Purchase']);
    });
  });

  describe('getInvoiceExportStatus', () => {
    it('calls GET /invoices/exports/{ref}', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'export-ref',
        status: 'Completed',
        downloadUrl: 'https://storage.example.com/export.zip'
      });

      const service = new InvoiceV2Service(mockHttpClient as any, 'test');

      const result = await service.getInvoiceExportStatus('token', 'export-ref-123');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/invoices/exports/export-ref-123');
      expect(result.status).toBe('Completed');
    });
  });

  describe('getInvoiceByKsefNumber', () => {
    it('calls GET /invoices/ksef/{ksefNumber}', async () => {
      mockHttpClient.mockResponse('<?xml version="1.0"?><Invoice>...</Invoice>', {
        headers: {
          'x-ms-meta-hash': 'invoice-hash-base64'
        }
      });

      const service = new InvoiceV2Service(mockHttpClient as any, 'test');

      const result = await service.getInvoiceByKsefNumber('token', '12345678901234567890123456789012345');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/invoices/ksef/12345678901234567890123456789012345');
      expect(request?.headers?.['Authorization']).toBe('Bearer token');
      expect(request?.headers?.['Accept']).toBe('application/xml');
      expect(result.xml).toBe('<?xml version="1.0"?><Invoice>...</Invoice>');
      expect(result.hash).toBe('invoice-hash-base64');
    });

    it('handles missing hash header', async () => {
      mockHttpClient.mockResponse('<?xml version="1.0"?><Invoice>...</Invoice>', {
        headers: {}
      });

      const service = new InvoiceV2Service(mockHttpClient as any, 'test');

      const result = await service.getInvoiceByKsefNumber('token', '12345678901234567890123456789012345');

      expect(result.xml).toBe('<?xml version="1.0"?><Invoice>...</Invoice>');
      expect(result.hash).toBeNull();
    });
  });

  describe('environment URLs', () => {
    it('uses test environment URL', async () => {
      mockHttpClient.mockResponse({});

      const service = new InvoiceV2Service(mockHttpClient as any, 'test');
      await service.queryMetadata('token', { dateFrom: '2024-01-01' });

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('api-test.ksef.mf.gov.pl');
    });

    it('uses prod environment URL', async () => {
      mockHttpClient.mockResponse({});

      const service = new InvoiceV2Service(mockHttpClient as any, 'prod');
      await service.queryMetadata('token', { dateFrom: '2024-01-01' });

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('api.ksef.mf.gov.pl');
    });
  });
});

