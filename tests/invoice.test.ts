/**
 * Tests for InvoiceService
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { InvoiceService } from '../src/services/invoice.js';
import { ProcessError, ValidationError } from '../src/types/common.js';
import type { SessionToken } from '../src/types/auth.js';
import type { 
  InvoiceSubmissionResult,
  InvoiceStatusResponse,
  GetInvoiceResponse,
  PagedInvoiceResponse,
  UpoResponse,
  QueryInvoiceRequest,
  AsyncQueryInvoiceRequest,
  BatchSubmissionResult
} from '../src/types/invoice.js';
import { Status, SubjectType, DateType } from '../src/types/invoice.js';

// Mock the crypto utils
vi.mock('../src/utils/crypto.js', () => ({
  generateSHA256Hash: vi.fn(() => 'mock-sha256-hash'),
  toBase64: vi.fn((data) => Buffer.from(data).toString('base64')),
  fromBase64: vi.fn((data) => Buffer.from(data, 'base64').toString())
}));

// Mock the http utils
vi.mock('../src/utils/http.js', () => ({
  createRequestBody: vi.fn((data) => JSON.stringify(data)),
  buildQueryString: vi.fn((params) => Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&'))
}));

describe('InvoiceService', () => {
  let invoiceService: InvoiceService;
  let mockHttpClient: any;
  let mockSessionToken: SessionToken;

  beforeEach(() => {
    mockHttpClient = {
      request: vi.fn()
    };

    mockSessionToken = {
      token: 'mock-session-token',
      context: {
        contextIdentifier: { type: 'onip', value: '1234567890' },
        credentialsRoleList: ['USER']
      }
    };

    invoiceService = new InvoiceService(mockHttpClient, 'https://test.ksef.mf.gov.pl/api/v2', true);
  });

  describe('Constructor', () => {
    it('should initialize with correct parameters', () => {
      expect(invoiceService).toBeDefined();
    });

    it('should handle debug mode correctly', () => {
      const debugService = new InvoiceService(mockHttpClient, 'https://test.ksef.mf.gov.pl/api/v2', true);
      const nonDebugService = new InvoiceService(mockHttpClient, 'https://test.ksef.mf.gov.pl/api/v2', false);
      
      expect(debugService).toBeDefined();
      expect(nonDebugService).toBeDefined();
    });
  });

  describe('submitInvoice', () => {
    it('should submit invoice successfully', async () => {
      const invoiceXml = '<Fa>Test Invoice</Fa>';
      
      const mockInvoiceResponse = {
        elementReferenceNumber: 'elem-ref-123',
        processingCode: 100,
        processingDescription: 'Processing',
        referenceNumber: 'ref-123',
        timestamp: '2024-01-15T10:30:00Z'
      };

      const mockStatusResponse: InvoiceStatusResponse = {
        referenceNumber: 'ref-123',
        processingCode: 200,
        processingDescription: 'Completed',
        timestamp: '2024-01-15T10:31:00Z',
        acquisitionTimestamp: '2024-01-15T10:31:00Z',
        ksefReferenceNumber: 'ksef-ref-123',
        status: Status.ACCEPTED
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockInvoiceResponse }) // Submit invoice
        .mockResolvedValueOnce({ data: mockStatusResponse }); // Poll status

      const result = await invoiceService.submitInvoice(invoiceXml, mockSessionToken);

      expect(result).toEqual({
        ksefReferenceNumber: 'ksef-ref-123',
        referenceNumber: 'ref-123',
        acquisitionTimestamp: '2024-01-15T10:31:00Z',
        status: Status.ACCEPTED
      });

      expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
    });

    it('should handle invoice submission failure', async () => {
      const invoiceXml = '<Fa>Invalid Invoice</Fa>';

      mockHttpClient.request.mockRejectedValueOnce(new Error('Validation failed'));

      await expect(invoiceService.submitInvoice(invoiceXml, mockSessionToken))
        .rejects.toThrow('Validation failed');
    });

    it('should handle status polling timeout', async () => {
      const invoiceXml = '<Fa>Test Invoice</Fa>';
      
      const mockInvoiceResponse = {
        elementReferenceNumber: 'elem-ref-123',
        processingCode: 100,
        processingDescription: 'Processing',
        referenceNumber: 'ref-123',
        timestamp: '2024-01-15T10:30:00Z'
      };

      const mockPendingStatus: InvoiceStatusResponse = {
        referenceNumber: 'ref-123',
        processingCode: 100,
        processingDescription: 'Still processing',
        timestamp: '2024-01-15T10:31:00Z'
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockInvoiceResponse })
        .mockResolvedValue({ data: mockPendingStatus }); // Always return pending

      await expect(invoiceService.submitInvoice(invoiceXml, mockSessionToken, { timeout: 1000 }))
        .rejects.toThrow(ProcessError);
    });

    it('should handle missing KSeF reference number', async () => {
      const invoiceXml = '<Fa>Test Invoice</Fa>';
      
      const mockInvoiceResponse = {
        elementReferenceNumber: 'elem-ref-123',
        processingCode: 100,
        processingDescription: 'Processing',
        referenceNumber: 'ref-123',
        timestamp: '2024-01-15T10:30:00Z'
      };

      const mockStatusResponse: InvoiceStatusResponse = {
        referenceNumber: 'ref-123',
        processingCode: 200,
        processingDescription: 'Completed',
        timestamp: '2024-01-15T10:31:00Z',
        // Missing ksefReferenceNumber
        status: Status.ACCEPTED
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockInvoiceResponse })
        .mockResolvedValueOnce({ data: mockStatusResponse });

      await expect(invoiceService.submitInvoice(invoiceXml, mockSessionToken))
        .rejects.toThrow(ProcessError);
    });
  });

  describe('submitInvoicesBatch', () => {
    it('should submit multiple invoices in batch successfully', async () => {
      const invoicesXml = [
        '<Fa>Invoice 1</Fa>',
        '<Fa>Invoice 2</Fa>'
      ];

      const mockBatchResponse = {
        batchReferenceNumber: 'batch-ref-123',
        invoiceResponses: [
          { referenceNumber: 'ref-1', elementReferenceNumber: 'elem-1', processingCode: 100, processingDescription: 'Processing', timestamp: '2024-01-15T10:30:00Z' },
          { referenceNumber: 'ref-2', elementReferenceNumber: 'elem-2', processingCode: 100, processingDescription: 'Processing', timestamp: '2024-01-15T10:30:00Z' }
        ],
        status: {
          processingCode: 100,
          processingDescription: 'Processing',
          referenceNumber: 'batch-status-ref',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      const mockBatchStatus = {
        batchReferenceNumber: 'batch-ref-123',
        processingCode: 200,
        processingDescription: 'Completed',
        timestamp: '2024-01-15T10:31:00Z',
        processedCount: 2,
        totalCount: 2,
        invoiceStatuses: [
          {
            referenceNumber: 'ref-1',
            processingCode: 200,
            processingDescription: 'Completed',
            timestamp: '2024-01-15T10:31:00Z',
            ksefReferenceNumber: 'ksef-1',
            acquisitionTimestamp: '2024-01-15T10:31:00Z',
            status: Status.ACCEPTED
          },
          {
            referenceNumber: 'ref-2',
            processingCode: 200,
            processingDescription: 'Completed',
            timestamp: '2024-01-15T10:31:00Z',
            ksefReferenceNumber: 'ksef-2',
            acquisitionTimestamp: '2024-01-15T10:31:00Z',
            status: Status.ACCEPTED
          }
        ]
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockBatchResponse }) // Submit batch
        .mockResolvedValueOnce({ data: mockBatchStatus }) // Poll batch status
        .mockResolvedValueOnce({ data: { batchReferenceNumber: 'final-batch-ref' } }); // Final batch ref call

      const result = await invoiceService.submitInvoicesBatch(invoicesXml, mockSessionToken);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.totalCount).toBe(2);
    });

    it('should handle empty invoice array', async () => {
      const invoicesXml: string[] = [];

      // Mock the final batch reference call for empty array
      mockHttpClient.request.mockResolvedValueOnce({ data: { batchReferenceNumber: 'empty-batch-ref' } });

      const result = await invoiceService.submitInvoicesBatch(invoicesXml, mockSessionToken);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should handle batch processing with custom batch size', async () => {
      const invoicesXml = Array(5).fill('<Fa>Invoice</Fa>');

      // Mock multiple batch submissions due to batch size
      const mockBatchResponse = {
        batchReferenceNumber: 'batch-ref-123',
        invoiceResponses: [],
        status: {
          processingCode: 200,
          processingDescription: 'Completed',
          referenceNumber: 'batch-status-ref',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      const mockBatchStatus = {
        batchReferenceNumber: 'batch-ref-123',
        processingCode: 200,
        processingDescription: 'Completed',
        timestamp: '2024-01-15T10:31:00Z',
        processedCount: 0,
        totalCount: 0,
        invoiceStatuses: []
      };

      mockHttpClient.request
        .mockResolvedValue({ data: mockBatchResponse })
        .mockResolvedValue({ data: mockBatchStatus });

      const result = await invoiceService.submitInvoicesBatch(invoicesXml, mockSessionToken, { batchSize: 2 });

      expect(result).toBeDefined();
    });
  });

  describe('getInvoice', () => {
    it('should retrieve invoice successfully', async () => {
      const ksefReferenceNumber = 'ksef-ref-123';
      
      const mockInvoiceResponse: GetInvoiceResponse = {
        invoiceBody: 'base64-encoded-xml',
        invoiceMetadata: {
          ksefNumber: ksefReferenceNumber,
          invoiceNumber: 'INV-001',
          invoiceDate: '2024-01-15',
          acquisitionDate: '2024-01-15',
          seller: {
            identifier: { type: 'onip', value: '1234567890' },
            name: 'Test Seller'
          },
          buyer: {
            identifierType: 'NIP',
            identifier: '9876543210',
            name: 'Test Buyer'
          },
          grossAmount: 1230,
          netAmount: 1000,
          vatAmount: 230,
          currency: 'PLN',
          formCode: 'FA(3)',
          invoiceType: 'VAT' as any,
          invoicingMode: 'INTERACTIVE' as any,
          isHidden: false,
          isSelfInvoicing: false
        }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockInvoiceResponse });

      const result = await invoiceService.getInvoice(ksefReferenceNumber, mockSessionToken);

      expect(result).toEqual(mockInvoiceResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: `https://test.ksef.mf.gov.pl/api/v2/online/Invoice/Get/${ksefReferenceNumber}`,
          headers: {
            'SessionToken': 'Token mock-session-token'
          }
        })
      );
    });

    it('should handle invoice not found', async () => {
      const ksefReferenceNumber = 'non-existent-ref';

      const notFoundError = new Error('Invoice not found');
      (notFoundError as any).status = 404;
      mockHttpClient.request.mockRejectedValueOnce(notFoundError);

      await expect(invoiceService.getInvoice(ksefReferenceNumber, mockSessionToken))
        .rejects.toThrow('Invoice not found');
    });
  });

  describe('queryInvoices', () => {
    it('should query invoices successfully', async () => {
      const queryRequest: QueryInvoiceRequest = {
        subjectType: SubjectType.SUBJECT1,
        dateRange: {
          dateType: DateType.INVOICE_DATE,
          from: '2024-01-01',
          to: '2024-01-31'
        },
        pageSize: 10,
        pageOffset: 0
      };

      const mockQueryResponse: PagedInvoiceResponse = {
        invoiceMetadataList: [],
        numberOfElements: 0,
        pageOffset: 0,
        pageSize: 10,
        totalElements: 0,
        totalPages: 0
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockQueryResponse });

      const result = await invoiceService.queryInvoices(queryRequest, mockSessionToken);

      expect(result).toEqual(mockQueryResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://test.ksef.mf.gov.pl/api/v2/online/Invoice/Query',
          headers: {
            'SessionToken': 'Token mock-session-token'
          }
        })
      );
    });

    it('should handle query validation errors', async () => {
      const invalidQuery = {} as QueryInvoiceRequest;

      const validationError = new Error('Invalid query parameters');
      (validationError as any).status = 400;
      mockHttpClient.request.mockRejectedValueOnce(validationError);

      await expect(invoiceService.queryInvoices(invalidQuery, mockSessionToken))
        .rejects.toThrow('Invalid query parameters');
    });
  });

  describe('queryInvoicesAsync', () => {
    it('should submit async query successfully', async () => {
      const queryRequest: AsyncQueryInvoiceRequest = {
        subjectType: SubjectType.SUBJECT1,
        dateRange: {
          dateType: DateType.INVOICE_DATE,
          from: '2024-01-01',
          to: '2024-01-31'
        },
        queryType: 'ASYNCHRONOUS'
      };

      const mockAsyncResponse = {
        elementReferenceNumber: 'elem-ref-123',
        processingCode: 100,
        processingDescription: 'Processing',
        referenceNumber: 'async-ref-123',
        timestamp: '2024-01-15T10:30:00Z'
      };

      const mockStatusResponse = {
        referenceNumber: 'async-ref-123',
        processingCode: 200,
        processingDescription: 'Completed',
        timestamp: '2024-01-15T10:31:00Z',
        result: {
          invoiceMetadataList: [],
          numberOfElements: 0,
          pageOffset: 0,
          pageSize: 10,
          totalElements: 0,
          totalPages: 0
        }
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockAsyncResponse }) // Submit async query
        .mockResolvedValueOnce({ data: mockStatusResponse }); // Poll status

      const result = await invoiceService.queryInvoicesAsync(queryRequest, mockSessionToken);

      expect(result).toEqual(mockStatusResponse.result);
      expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
    });

    it('should handle async query timeout', async () => {
      const queryRequest: AsyncQueryInvoiceRequest = {
        subjectType: SubjectType.SUBJECT1,
        dateRange: {
          dateType: DateType.INVOICE_DATE,
          from: '2024-01-01',
          to: '2024-01-31'
        }
      };

      const mockAsyncResponse = {
        elementReferenceNumber: 'elem-ref-123',
        processingCode: 100,
        processingDescription: 'Processing',
        referenceNumber: 'async-ref-123',
        timestamp: '2024-01-15T10:30:00Z'
      };

      const mockPendingStatus = {
        referenceNumber: 'async-ref-123',
        processingCode: 100,
        processingDescription: 'Still processing',
        timestamp: '2024-01-15T10:31:00Z'
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockAsyncResponse })
        .mockResolvedValue({ data: mockPendingStatus }); // Always pending

      await expect(invoiceService.queryInvoicesAsync(queryRequest, mockSessionToken, { timeout: 1000 }))
        .rejects.toThrow(ProcessError);
    });
  });

  describe('getUpo', () => {
    it('should retrieve UPO successfully', async () => {
      const referenceNumber = 'ref-123';
      
      const mockUpoResponse: UpoResponse = {
        upo: new Uint8Array([1, 2, 3, 4]), // Mock PDF bytes as Uint8Array
        fileName: 'upo-123.pdf',
        contentType: 'application/pdf'
      };

      // Mock raw UPO data (base64 encoded PDF)
      const mockUpoData = Buffer.from([1, 2, 3, 4]).toString('base64');
      mockHttpClient.request.mockResolvedValueOnce({ 
        data: mockUpoData,
        headers: {
          'content-disposition': 'attachment; filename="upo-123.pdf"',
          'content-type': 'application/pdf'
        }
      });

      const { fromBase64 } = await import('../src/utils/crypto.js');
      vi.mocked(fromBase64).mockReturnValueOnce(Buffer.from([1, 2, 3, 4]));

      const result = await invoiceService.getUpo(referenceNumber, mockSessionToken);

      expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUpoResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: `https://test.ksef.mf.gov.pl/api/v2/online/Invoice/GetUpo/${referenceNumber}`,
          headers: {
            'SessionToken': 'Token mock-session-token'
          }
        })
      );
    });

    it('should handle UPO not available', async () => {
      const referenceNumber = 'ref-no-upo';

      const notFoundError = new Error('UPO not available');
      (notFoundError as any).status = 404;
      mockHttpClient.request.mockRejectedValueOnce(notFoundError);

      await expect(invoiceService.getUpo(referenceNumber, mockSessionToken))
        .rejects.toThrow('UPO not available');
    });
  });

  describe('getInvoiceStatus', () => {
    it('should get invoice status successfully', async () => {
      const referenceNumber = 'ref-123';
      
      const mockStatusResponse: InvoiceStatusResponse = {
        referenceNumber,
        processingCode: 200,
        processingDescription: 'Completed',
        timestamp: '2024-01-15T10:31:00Z',
        acquisitionTimestamp: '2024-01-15T10:31:00Z',
        ksefReferenceNumber: 'ksef-ref-123',
        status: Status.ACCEPTED
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockStatusResponse });

      const result = await invoiceService.getInvoiceStatus(referenceNumber, mockSessionToken);

      expect(result).toEqual(mockStatusResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: `https://test.ksef.mf.gov.pl/api/v2/online/Invoice/Status/${referenceNumber}`,
          headers: {
            'SessionToken': 'Token mock-session-token'
          }
        })
      );
    });

    it('should handle status not found', async () => {
      const referenceNumber = 'invalid-ref';

      const notFoundError = new Error('Reference not found');
      (notFoundError as any).status = 404;
      mockHttpClient.request.mockRejectedValueOnce(notFoundError);

      await expect(invoiceService.getInvoiceStatus(referenceNumber, mockSessionToken))
        .rejects.toThrow('Reference not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP 401 errors', async () => {
      const invoiceXml = '<Fa>Test Invoice</Fa>';

      const unauthorizedError = new Error('Unauthorized');
      (unauthorizedError as any).status = 401;
      mockHttpClient.request.mockRejectedValueOnce(unauthorizedError);

      await expect(invoiceService.submitInvoice(invoiceXml, mockSessionToken))
        .rejects.toThrow('Unauthorized');
    });

    it('should handle HTTP 500 errors', async () => {
      const invoiceXml = '<Fa>Test Invoice</Fa>';

      const serverError = new Error('Internal Server Error');
      (serverError as any).status = 500;
      mockHttpClient.request.mockRejectedValueOnce(serverError);

      await expect(invoiceService.submitInvoice(invoiceXml, mockSessionToken))
        .rejects.toThrow('Internal Server Error');
    });

    it('should handle network timeouts', async () => {
      const invoiceXml = '<Fa>Test Invoice</Fa>';

      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'TIMEOUT';
      mockHttpClient.request.mockRejectedValueOnce(timeoutError);

      await expect(invoiceService.submitInvoice(invoiceXml, mockSessionToken))
        .rejects.toThrow('Request timeout');
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed XML in invoice', async () => {
      const malformedXml = '<Fa>Unclosed tag';

      // Should still proceed to API call (validation might be server-side)
      mockHttpClient.request.mockRejectedValueOnce(new Error('XML validation failed'));

      await expect(invoiceService.submitInvoice(malformedXml, mockSessionToken))
        .rejects.toThrow('XML validation failed');
    });

    it('should handle very large invoice XML', async () => {
      const largeXml = '<Fa>' + 'x'.repeat(1000000) + '</Fa>';

      const mockInvoiceResponse = {
        elementReferenceNumber: 'elem-ref-large',
        processingCode: 100,
        processingDescription: 'Processing',
        referenceNumber: 'ref-large',
        timestamp: '2024-01-15T10:30:00Z'
      };

      const mockStatusResponse: InvoiceStatusResponse = {
        referenceNumber: 'ref-large',
        processingCode: 200,
        processingDescription: 'Completed',
        timestamp: '2024-01-15T10:31:00Z',
        acquisitionTimestamp: '2024-01-15T10:31:00Z',
        ksefReferenceNumber: 'ksef-ref-large',
        status: Status.ACCEPTED
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockInvoiceResponse })
        .mockResolvedValueOnce({ data: mockStatusResponse });

      // Should handle large content gracefully
      const result = await invoiceService.submitInvoice(largeXml, mockSessionToken);
      expect(result).toBeDefined();
      expect(result.ksefReferenceNumber).toBe('ksef-ref-large');
    });

    it('should handle session token with different context types', async () => {
      const peselSessionToken: SessionToken = {
        token: 'pesel-session-token',
        context: {
          contextIdentifier: { type: 'pesel', value: '12345678901' },
          credentialsRoleList: ['USER']
        }
      };

      const invoiceXml = '<Fa>Test Invoice</Fa>';
      
      const mockResponse = {
        elementReferenceNumber: 'elem-ref-pesel',
        processingCode: 100,
        processingDescription: 'Processing',
        referenceNumber: 'ref-pesel',
        timestamp: '2024-01-15T10:30:00Z'
      };

      const mockStatusResponse = {
        referenceNumber: 'ref-pesel',
        processingCode: 200,
        processingDescription: 'Completed',
        timestamp: '2024-01-15T10:31:00Z',
        acquisitionTimestamp: '2024-01-15T10:31:00Z',
        ksefReferenceNumber: 'ksef-pesel',
        status: Status.ACCEPTED
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockResponse }) // Submit invoice
        .mockResolvedValueOnce({ data: mockStatusResponse }); // Poll status

      await expect(invoiceService.submitInvoice(invoiceXml, peselSessionToken)).resolves.toBeDefined();
    });
  });
});
