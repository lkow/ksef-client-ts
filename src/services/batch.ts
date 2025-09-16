/**
 * Batch processing service for KSeF API
 */

import type { SessionToken } from '@/types/auth.js';
import type { ContextIdentifier } from '@/types/common.js';
import type { HttpClient, HttpRequestOptions } from '@/utils/http.js';
import type { OperationOptions } from '@/types/config.js';
import type {
  InvoiceSubmissionResult,
  BatchSessionRequest,
  BatchSessionResponse,
  CloseBatchRequest,
  BatchInvoiceRequest,
  BatchStatus
} from '@/types/invoice.js';
import { Status } from '@/types/invoice.js';
import { createRequestBody } from '@/utils/http.js';
import { generateSHA256Hash } from '@/utils/crypto.js';
import { InvoiceService } from './invoice.js';
import { ProcessError } from '@/types/common.js';
import { Logger } from '@/utils/logger.js';

export interface BatchSubmissionResult {
  batchReferenceNumber: string;
  invoiceResults: InvoiceSubmissionResult[];
  hasErrors: boolean;
  successCount: number;
  errorCount: number;
}

export class BatchService {
  private httpClient: HttpClient;
  private baseUrl: string;
  private debug: boolean;
  private invoiceService: InvoiceService;
  private logger: Logger;

  constructor(httpClient: HttpClient, baseUrl: string, debug = false) {
    this.httpClient = httpClient;
    this.baseUrl = baseUrl;
    this.debug = debug;
    this.invoiceService = new InvoiceService(httpClient, baseUrl, debug);
    this.logger = new Logger({
      debug,
      prefix: '[KSeF Batch]'
    });
  }

  /**
   * Submit multiple invoices in batch mode
   */
  async submitBatch(
    invoices: string[],
    sessionToken: SessionToken,
    options: OperationOptions = {}
  ): Promise<BatchSubmissionResult> {
    this.log(`Starting batch submission for ${invoices.length} invoices`);

    // Open batch session
    const batchSession = await this.openBatchSession(sessionToken);
    this.log(`Batch session opened: ${batchSession.referenceNumber}`);

    const results: InvoiceSubmissionResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    try {
      // Submit invoices one by one in the batch session
      for (let i = 0; i < invoices.length; i++) {
        const invoiceXml = invoices[i];
        this.log(`Submitting invoice ${i + 1}/${invoices.length}`);
        if (!invoiceXml) {
          throw new ProcessError(`Invoice ${i + 1} is undefined`);
        }
        try {
          const result = await this.invoiceService.submitInvoice(
            invoiceXml,
            sessionToken,
            options
          );
          results.push(result);
          successCount++;
        } catch (error) {
          this.log(`Error submitting invoice ${i + 1}: ${error}`);
          
          // Create error result
          const errorResult: InvoiceSubmissionResult = {
            referenceNumber: Math.random().toString(36).substring(2, 15),
            ksefReferenceNumber: '',
            acquisitionTimestamp: '',
            status: Status.REJECTED
          };
          
          results.push(errorResult);
          errorCount++;
        }
      }

      // Close batch session
      await this.closeBatchSession(batchSession.referenceNumber, sessionToken);
      this.log('Batch session closed');

    } catch (error) {
      this.log(`Batch processing failed: ${error}`);
      throw new ProcessError(`Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const result: BatchSubmissionResult = {
      batchReferenceNumber: batchSession.referenceNumber,
      invoiceResults: results,
      hasErrors: errorCount > 0,
      successCount,
      errorCount
    };

    this.log(`Batch completed: ${successCount} success, ${errorCount} errors`);
    return result;
  }

  /**
   * Open a batch session
   */
  async openBatchSession(sessionToken: SessionToken): Promise<BatchSessionResponse> {
    const request: BatchSessionRequest = {
      keepSessionOpen: true
    };

    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Session/InitSigned/Batch`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      },
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<BatchSessionResponse>(requestOptions);
    return response.data;
  }

  /**
   * Close a batch session
   */
  async closeBatchSession(
    batchReferenceNumber: string,
    sessionToken: SessionToken
  ): Promise<void> {
    const request: CloseBatchRequest = {
      referenceNumber: batchReferenceNumber
    };

    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Session/Close`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      },
      body: createRequestBody(request)
    };

    await this.httpClient.request(requestOptions);
  }

  /**
   * Get batch processing status
   */
  async getBatchStatus(
    batchReferenceNumber: string,
    sessionToken: SessionToken
  ): Promise<BatchStatus> {
    const requestOptions: HttpRequestOptions = {
      method: 'GET',
      url: `${this.baseUrl}/online/Session/Status/${batchReferenceNumber}`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      }
    };

    const response = await this.httpClient.request<BatchStatus>(requestOptions);
    return response.data;
  }

  /**
   * Submit a single invoice in batch mode
   */
  async submitBatchInvoice(
    invoiceXml: string,
    batchReferenceNumber: string,
    sessionToken: SessionToken
  ): Promise<InvoiceSubmissionResult> {
    // Calculate invoice hash and size
    const invoiceBuffer = Buffer.from(invoiceXml, 'utf-8');
    const invoiceHash = generateSHA256Hash(invoiceBuffer);

    const request: BatchInvoiceRequest = {
      invoices: [{
        hashSHA: invoiceHash,
        fileSize: invoiceBuffer.length,
        invoiceBody: invoiceBuffer.toString('base64')
      }],
      batchSize: 1
    };

    const requestOptions: HttpRequestOptions = {
      method: 'PUT',
      url: `${this.baseUrl}/online/Invoice/Send/Batch`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      },
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<InvoiceSubmissionResult>(requestOptions);
    return response.data;
  }

  private log(message: string): void {
    this.logger.debug(message);
  }
} 