/**
 * Tests for BatchService
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { BatchService, type BatchSubmissionResult } from '../src/services/batch.js';
import { ProcessError } from '../src/types/common.js';
import type { SessionToken } from '../src/types/auth.js';
import type { 
  BatchSessionResponse,
  InvoiceSubmissionResult
} from '../src/types/invoice.js';
import { Status, BatchStatus } from '../src/types/invoice.js';
import { RoleType } from '../src/types/permissions.js';

// Mock the invoice service
vi.mock('../src/services/invoice.js', () => ({
  InvoiceService: vi.fn().mockImplementation(() => ({
    submitInvoice: vi.fn()
  }))
}));

// Mock the http utils
vi.mock('../src/utils/http.js', () => ({
  createRequestBody: vi.fn((data) => JSON.stringify(data))
}));

describe('BatchService', () => {
  let batchService: BatchService;
  let mockHttpClient: any;
  let mockSessionToken: SessionToken;
  let mockInvoiceService: any;

  beforeEach(() => {
    mockHttpClient = {
      request: vi.fn()
    };

    mockSessionToken = {
      token: 'mock-session-token',
      context: {
        contextIdentifier: { type: 'onip', value: '1234567890' },
        credentialsRoleList: [RoleType.INVOICE_WRITE]
      }
    };

    batchService = new BatchService(mockHttpClient, 'https://test.ksef.mf.gov.pl/api/v2', true);
    
    // Get the mocked invoice service instance
    const { InvoiceService } = require('../src/services/invoice.js');
    mockInvoiceService = InvoiceService.mock.results[0].value;
  });

  describe('Constructor', () => {
    it('should initialize with correct parameters', () => {
      expect(batchService).toBeDefined();
    });

    it('should handle debug mode correctly', () => {
      const debugService = new BatchService(mockHttpClient, 'https://test.ksef.mf.gov.pl/api/v2', true);
      const nonDebugService = new BatchService(mockHttpClient, 'https://test.ksef.mf.gov.pl/api/v2', false);
      
      expect(debugService).toBeDefined();
      expect(nonDebugService).toBeDefined();
    });
  });

  describe('submitBatch', () => {
    it('should submit multiple invoices successfully', async () => {
      const invoices = [
        '<Fa>Invoice 1</Fa>',
        '<Fa>Invoice 2</Fa>',
        '<Fa>Invoice 3</Fa>'
      ];

      const mockBatchSession: BatchSessionResponse = {
        referenceNumber: 'batch-ref-123',
        sessionToken: 'batch-session-token',
        status: { 
          processingCode: 200, 
          processingDescription: 'Success',
          referenceNumber: 'status-ref-123',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      const mockInvoiceResults: InvoiceSubmissionResult[] = [
        {
          referenceNumber: 'inv-ref-1',
          ksefReferenceNumber: 'ksef-1',
          acquisitionTimestamp: '2024-01-15T10:30:00Z',
          status: Status.ACCEPTED
        },
        {
          referenceNumber: 'inv-ref-2',
          ksefReferenceNumber: 'ksef-2',
          acquisitionTimestamp: '2024-01-15T10:31:00Z',
          status: Status.ACCEPTED
        },
        {
          referenceNumber: 'inv-ref-3',
          ksefReferenceNumber: 'ksef-3',
          acquisitionTimestamp: '2024-01-15T10:32:00Z',
          status: Status.ACCEPTED
        }
      ];

      // Mock batch session opening
      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockBatchSession }) // Open batch session
        .mockResolvedValueOnce({}); // Close batch session

      // Mock invoice submissions
      mockInvoiceService.submitInvoice
        .mockResolvedValueOnce(mockInvoiceResults[0])
        .mockResolvedValueOnce(mockInvoiceResults[1])
        .mockResolvedValueOnce(mockInvoiceResults[2]);

      const result = await batchService.submitBatch(invoices, mockSessionToken);

      expect(result).toEqual({
        batchReferenceNumber: 'batch-ref-123',
        invoiceResults: mockInvoiceResults,
        hasErrors: false,
        successCount: 3,
        errorCount: 0
      });

      expect(mockInvoiceService.submitInvoice).toHaveBeenCalledTimes(3);
      expect(mockHttpClient.request).toHaveBeenCalledTimes(2); // Open + close
    });

    it('should handle partial failures in batch', async () => {
      const invoices = [
        '<Fa>Valid Invoice</Fa>',
        '<Fa>Invalid Invoice</Fa>'
      ];

      const mockBatchSession: BatchSessionResponse = {
        referenceNumber: 'batch-ref-456',
        sessionToken: 'batch-session-token-456',
        status: { 
          processingCode: 200, 
          processingDescription: 'Success',
          referenceNumber: 'status-ref-456',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      const mockSuccessResult: InvoiceSubmissionResult = {
        referenceNumber: 'inv-ref-1',
        ksefReferenceNumber: 'ksef-1',
        acquisitionTimestamp: '2024-01-15T10:30:00Z',
        status: Status.ACCEPTED
      };

      // Mock batch session
      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockBatchSession })
        .mockResolvedValueOnce({});

      // Mock invoice submissions - one success, one failure
      mockInvoiceService.submitInvoice
        .mockResolvedValueOnce(mockSuccessResult)
        .mockRejectedValueOnce(new Error('Validation failed'));

      const result = await batchService.submitBatch(invoices, mockSessionToken);

      expect(result.hasErrors).toBe(true);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.invoiceResults).toHaveLength(2);
      expect(result.invoiceResults[0]).toEqual(mockSuccessResult);
      expect(result.invoiceResults[1].status).toBe(Status.REJECTED);
    });

    it('should handle empty invoice array', async () => {
      const invoices: string[] = [];

      const mockBatchSession: BatchSessionResponse = {
        referenceNumber: 'batch-ref-empty',
        sessionToken: 'batch-session-token-empty',
        status: { processingCode: 200, processingDescription: 'Success', referenceNumber: 'status-ref-empty', timestamp: '2024-01-15T10:30:00Z' }
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockBatchSession })
        .mockResolvedValueOnce({});

      const result = await batchService.submitBatch(invoices, mockSessionToken);

      expect(result.invoiceResults).toHaveLength(0);
      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(0);
      expect(result.hasErrors).toBe(false);
    });

    it('should handle undefined invoice in array', async () => {
      const invoices = ['<Fa>Valid Invoice</Fa>', undefined as any];

      const mockBatchSession: BatchSessionResponse = {
        referenceNumber: 'batch-ref-undefined',
        sessionToken: 'batch-session-token-undefined',
        status: { processingCode: 200, processingDescription: 'Success', referenceNumber: 'status-ref-undefined', timestamp: '2024-01-15T10:30:00Z' }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockBatchSession });

      await expect(batchService.submitBatch(invoices, mockSessionToken))
        .rejects.toThrow(ProcessError);
    });

    it('should handle batch session opening failure', async () => {
      const invoices = ['<Fa>Invoice</Fa>'];

      mockHttpClient.request.mockRejectedValueOnce(new Error('Session creation failed'));

      await expect(batchService.submitBatch(invoices, mockSessionToken))
        .rejects.toThrow('Session creation failed');
    });

    it('should handle batch session closing failure', async () => {
      const invoices = ['<Fa>Invoice</Fa>'];

      const mockBatchSession: BatchSessionResponse = {
        referenceNumber: 'batch-ref-close-fail',
        sessionToken: 'batch-session-token-close-fail',
        status: { processingCode: 200, processingDescription: 'Success', referenceNumber: 'status-ref-close-fail', timestamp: '2024-01-15T10:30:00Z' }
      };

      const mockInvoiceResult: InvoiceSubmissionResult = {
        referenceNumber: 'inv-ref-1',
        ksefReferenceNumber: 'ksef-1',
        acquisitionTimestamp: '2024-01-15T10:30:00Z',
        status: Status.ACCEPTED
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockBatchSession }) // Open succeeds
        .mockRejectedValueOnce(new Error('Close failed')); // Close fails

      mockInvoiceService.submitInvoice.mockResolvedValueOnce(mockInvoiceResult);

      await expect(batchService.submitBatch(invoices, mockSessionToken))
        .rejects.toThrow(ProcessError);
    });
  });

  describe('openBatchSession', () => {
    it('should open batch session successfully', async () => {
      const mockBatchSession: BatchSessionResponse = {
        referenceNumber: 'batch-ref-123',
        sessionToken: 'batch-session-token-123',
        status: { processingCode: 200, processingDescription: 'Success', referenceNumber: 'status-ref-123', timestamp: '2024-01-15T10:30:00Z' }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockBatchSession });

      const result = await batchService.openBatchSession(mockSessionToken);

      expect(result).toEqual(mockBatchSession);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://test.ksef.mf.gov.pl/api/v2/online/Session/InitSigned/Batch',
          headers: {
            'SessionToken': 'Token mock-session-token'
          }
        })
      );
    });

    it('should handle session opening failure', async () => {
      mockHttpClient.request.mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(batchService.openBatchSession(mockSessionToken))
        .rejects.toThrow('Unauthorized');
    });
  });

  describe('closeBatchSession', () => {
    it('should close batch session successfully', async () => {
      const batchReferenceNumber = 'batch-ref-123';

      mockHttpClient.request.mockResolvedValueOnce({});

      await batchService.closeBatchSession(batchReferenceNumber, mockSessionToken);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://test.ksef.mf.gov.pl/api/v2/online/Session/Close',
          headers: {
            'SessionToken': 'Token mock-session-token'
          }
        })
      );
    });

    it('should handle session closing failure', async () => {
      const batchReferenceNumber = 'batch-ref-123';

      mockHttpClient.request.mockRejectedValueOnce(new Error('Session not found'));

      await expect(batchService.closeBatchSession(batchReferenceNumber, mockSessionToken))
        .rejects.toThrow('Session not found');
    });
  });

  describe('getBatchStatus', () => {
    it('should get batch status successfully', async () => {
      const batchReferenceNumber = 'batch-ref-123';
      const mockBatchStatus: BatchStatus = {
        referenceNumber: batchReferenceNumber,
        processingCode: 200,
        processingDescription: 'Completed',
        invoiceCount: 0,
        successCount: 0,
        errorCount: 0
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockBatchStatus });

      const result = await batchService.getBatchStatus(batchReferenceNumber, mockSessionToken);

      expect(result).toEqual(mockBatchStatus);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: `https://test.ksef.mf.gov.pl/api/v2/online/Session/Status/${batchReferenceNumber}`,
          headers: {
            'SessionToken': 'Token mock-session-token'
          }
        })
      );
    });

    it('should handle status retrieval failure', async () => {
      const batchReferenceNumber = 'batch-ref-123';

      mockHttpClient.request.mockRejectedValueOnce(new Error('Reference not found'));

      await expect(batchService.getBatchStatus(batchReferenceNumber, mockSessionToken))
        .rejects.toThrow('Reference not found');
    });
  });

  describe('submitBatchInvoice', () => {
    it('should submit single invoice in batch successfully', async () => {
      const invoiceXml = '<Fa>Test Invoice</Fa>';
      const batchReferenceNumber = 'batch-ref-123';

      const mockResult: InvoiceSubmissionResult = {
        referenceNumber: 'inv-ref-1',
        ksefReferenceNumber: 'ksef-1',
        acquisitionTimestamp: '2024-01-15T10:30:00Z',
        status: Status.ACCEPTED
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockResult });

      // Access private method using type assertion
      const result = await (batchService as any).submitBatchInvoice(
        invoiceXml,
        batchReferenceNumber,
        mockSessionToken
      );

      expect(result).toEqual(mockResult);
    });

    it('should handle batch invoice submission failure', async () => {
      const invoiceXml = '<Fa>Invalid Invoice</Fa>';
      const batchReferenceNumber = 'batch-ref-123';

      mockHttpClient.request.mockRejectedValueOnce(new Error('Validation error'));

      await expect((batchService as any).submitBatchInvoice(
        invoiceXml,
        batchReferenceNumber,
        mockSessionToken
      )).rejects.toThrow('Validation error');
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP errors gracefully', async () => {
      const invoices = ['<Fa>Invoice</Fa>'];

      const httpError = new Error('Internal Server Error');
      (httpError as any).status = 500;
      mockHttpClient.request.mockRejectedValueOnce(httpError);

      await expect(batchService.submitBatch(invoices, mockSessionToken))
        .rejects.toThrow('Internal Server Error');
    });

    it('should handle network timeouts', async () => {
      const invoices = ['<Fa>Invoice</Fa>'];

      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'TIMEOUT';
      mockHttpClient.request.mockRejectedValueOnce(timeoutError);

      await expect(batchService.submitBatch(invoices, mockSessionToken))
        .rejects.toThrow('Request timeout');
    });

    it('should handle malformed responses', async () => {
      const batchReferenceNumber = 'batch-ref-123';

      mockHttpClient.request.mockResolvedValueOnce({ data: null });

      await expect(batchService.getBatchStatus(batchReferenceNumber, mockSessionToken))
        .resolves.toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle large batch of invoices', async () => {
      const invoices = Array(100).fill('<Fa>Invoice</Fa>');

      const mockBatchSession: BatchSessionResponse = {
        referenceNumber: 'batch-ref-large',
        sessionToken: 'batch-session-token-large',
        status: { processingCode: 200, processingDescription: 'Success', referenceNumber: 'status-ref-large', timestamp: '2024-01-15T10:30:00Z' }
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockBatchSession })
        .mockResolvedValueOnce({});

      // Mock all invoice submissions as successful
      for (let i = 0; i < 100; i++) {
        mockInvoiceService.submitInvoice.mockResolvedValueOnce({
          referenceNumber: `inv-ref-${i}`,
          ksefReferenceNumber: `ksef-${i}`,
          acquisitionTimestamp: '2024-01-15T10:30:00Z',
          status: Status.ACCEPTED
        });
      }

      const result = await batchService.submitBatch(invoices, mockSessionToken);

      expect(result.successCount).toBe(100);
      expect(result.errorCount).toBe(0);
      expect(mockInvoiceService.submitInvoice).toHaveBeenCalledTimes(100);
    });

    it('should handle session token with different context types', async () => {
      const peselSessionToken: SessionToken = {
        token: 'pesel-session-token',
        context: {
          contextIdentifier: { type: 'pesel', value: '12345678901' },
          credentialsRoleList: [RoleType.INVOICE_WRITE]
        }
      };

      const mockBatchSession: BatchSessionResponse = {
        referenceNumber: 'batch-ref-pesel',
        sessionToken: 'batch-session-token-pesel',
        status: { processingCode: 200, processingDescription: 'Success', referenceNumber: 'status-ref-pesel', timestamp: '2024-01-15T10:30:00Z' }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockBatchSession });

      const result = await batchService.openBatchSession(peselSessionToken);

      expect(result).toEqual(mockBatchSession);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'SessionToken': 'Token pesel-session-token'
          }
        })
      );
    });
  });
});
