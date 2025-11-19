/**
 * Invoice service for KSeF API
 */

import type {
  InvoiceRequest,
  InvoiceResponse,
  InvoiceMetadata,
  InvoiceStatusResponse,
  UpoResponse,
  GetInvoiceRequest,
  GetInvoiceResponse,
  QueryInvoiceRequest,
  PagedInvoiceResponse,
  AsyncQueryInvoiceRequest,
  AsyncQueryInvoiceResponse,
  AsyncQueryInvoiceStatusResponse,
  BatchInvoiceRequest,
  BatchInvoiceResponse,
  BatchStatusResponse,
  InvoiceSubmissionResult,
  BatchSubmissionResult
} from '@/types/invoice.js';
import { Status } from '@/types/invoice.js';
import type { SessionToken } from '@/types/auth.js';
import type { HttpClient, HttpRequestOptions } from '@/utils/http.js';
import type { InvoiceSubmissionOptions, OperationOptions, QueryOptions } from '@/types/config.js';
import { generateSHA256Hash, toBase64, fromBase64 } from '@/utils/crypto.js';
import { createRequestBody, buildQueryString } from '@/utils/http.js';
import { ProcessError, ValidationError } from '@/types/common.js';
import { Logger } from '@/utils/logger.js';

export class InvoiceService {
  private httpClient: HttpClient;
  private baseUrl: string;
  private debug: boolean;
  private logger: Logger;

  constructor(httpClient: HttpClient, baseUrl: string, debug = false) {
    this.httpClient = httpClient;
    this.baseUrl = baseUrl;
    this.debug = debug;
    this.logger = new Logger({
      debug,
      prefix: '[KSeF Invoice]'
    });
  }

  /**
   * Submit a single invoice in interactive mode
   */
  async submitInvoice(
    invoiceXml: string,
    sessionToken: SessionToken,
    options: InvoiceSubmissionOptions = {}
  ): Promise<InvoiceSubmissionResult> {
    this.logger.debug('Submitting invoice in interactive mode');

    // Prepare invoice request
    const invoiceRequest = this.prepareInvoiceRequest(invoiceXml);
    
    // Submit invoice
    const response = await this.sendInvoice(invoiceRequest, sessionToken);
    
    // Poll for completion
    const statusResponse = await this.pollInvoiceStatus(
      response.referenceNumber,
      sessionToken,
      options
    );

    if (!statusResponse.ksefReferenceNumber) {
      throw new ProcessError('Invoice submission completed but no KSeF reference number returned');
    }

    const result: InvoiceSubmissionResult = {
      ksefReferenceNumber: statusResponse.ksefReferenceNumber,
      referenceNumber: response.referenceNumber,
      acquisitionTimestamp: statusResponse.acquisitionTimestamp || new Date().toISOString(),
      status: statusResponse.status || Status.ACCEPTED
    };

    this.logger.debug('Invoice submitted successfully');
    return result;
  }

  /**
   * Submit multiple invoices in batch mode
   */
  async submitInvoicesBatch(
    invoicesXml: string[],
    sessionToken: SessionToken,
    options: InvoiceSubmissionOptions = {}
  ): Promise<BatchSubmissionResult> {
    try {
      this.logger.debug(`Submitting ${invoicesXml.length} invoices in batch mode`);

      const batchSize = options.batchSize || invoicesXml.length;
      const batches = this.chunkArray(invoicesXml, batchSize);
      const allResults: InvoiceSubmissionResult[] = [];

      for (const batch of batches) {
        const batchRequest: BatchInvoiceRequest = {
          invoices: batch.map(xml => this.prepareInvoiceRequest(xml)),
          batchSize: batch.length
        };

        const batchResponse = await this.sendInvoicesBatch(batchRequest, sessionToken);
        const batchStatusResponse = await this.pollBatchStatus(
          batchResponse.batchReferenceNumber,
          sessionToken,
          options
        );

        // Process individual invoice results
        for (const invoiceStatus of batchStatusResponse.invoiceStatuses) {
          if (invoiceStatus.ksefReferenceNumber) {
            const result: InvoiceSubmissionResult = {
              ksefReferenceNumber: invoiceStatus.ksefReferenceNumber,
              referenceNumber: invoiceStatus.referenceNumber,
              acquisitionTimestamp: invoiceStatus.acquisitionTimestamp || new Date().toISOString(),
              status: invoiceStatus.status || Status.ACCEPTED
            };

            // Retrieve UPO if requested
            if (options.retrieveUpo) {
              try {
                const upoResponse = await this.getUpo(invoiceStatus.referenceNumber, sessionToken);
                result.upo = upoResponse.upo;
              } catch (error) {
                this.logger.debug(`Failed to retrieve UPO for ${invoiceStatus.referenceNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }

            allResults.push(result);
          }
        }
      }

      const successCount = allResults.filter(r => r.status === Status.ACCEPTED).length;
      const failureCount = allResults.length - successCount;

      const batchResult: BatchSubmissionResult = {
        batchReferenceNumber: batches.length > 1 ? `MULTI-${Date.now()}` : (await this.sendInvoicesBatch({ invoices: [], batchSize: 0 }, sessionToken)).batchReferenceNumber,
        totalCount: invoicesXml.length,
        successCount,
        failureCount,
        results: allResults
      };

      this.logger.debug(`Batch submission completed: ${successCount} successful, ${failureCount} failed`);
      return batchResult;

    } catch (error) {
      this.logger.debug(`Batch submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get an invoice by KSeF reference number
   */
  async getInvoice(
    ksefReferenceNumber: string,
    sessionToken: SessionToken
  ): Promise<GetInvoiceResponse> {
    const requestOptions: HttpRequestOptions = {
      method: 'GET',
      url: `${this.baseUrl}/online/Invoice/Get/${ksefReferenceNumber}`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      }
    };

    const response = await this.httpClient.request<GetInvoiceResponse>(requestOptions);
    return response.data;
  }

  /**
   * Query invoices with filters
   */
  async queryInvoices(
    request: QueryInvoiceRequest,
    sessionToken: SessionToken
  ): Promise<PagedInvoiceResponse> {
    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Invoice/Query`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      },
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<PagedInvoiceResponse>(requestOptions);
    return response.data;
  }

  /**
   * Query invoices asynchronously
   */
  async queryInvoicesAsync(
    request: AsyncQueryInvoiceRequest,
    sessionToken: SessionToken,
    options: OperationOptions = {}
  ): Promise<PagedInvoiceResponse> {
    // Initiate async query
    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Invoice/QueryAsync`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      },
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<AsyncQueryInvoiceResponse>(requestOptions);
    
    // Poll for results
    const finalResponse = await this.pollAsyncQueryStatus(
      response.data.referenceNumber,
      sessionToken,
      options
    );

    if (!finalResponse.result) {
      throw new ProcessError('Async query completed but no results returned');
    }

    return finalResponse.result;
  }

  /**
   * Get UPO (official receipt) for an invoice
   */
  async getUpo(
    referenceNumber: string,
    sessionToken: SessionToken
  ): Promise<UpoResponse> {
    const requestOptions: HttpRequestOptions = {
      method: 'GET',
      url: `${this.baseUrl}/online/Invoice/GetUpo/${referenceNumber}`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      }
    };

    const response = await this.httpClient.request<string>(requestOptions);
    
    // Parse UPO response - assuming it's base64 encoded or binary
    const upoBuffer = typeof response.data === 'string' ? 
      fromBase64(response.data) : 
      Buffer.from(response.data as any);
    const fileName = response.headers['content-disposition']?.match(/filename="?([^"]+)"?/)?.[1] || 'upo.pdf';
    const contentType = response.headers['content-type'] || 'application/pdf';
    
    return {
      upo: new Uint8Array(upoBuffer),
      fileName,
      contentType
    };
  }

  /**
   * Check invoice status
   */
  async getInvoiceStatus(
    referenceNumber: string,
    sessionToken: SessionToken
  ): Promise<InvoiceStatusResponse> {
    const requestOptions: HttpRequestOptions = {
      method: 'GET',
      url: `${this.baseUrl}/online/Invoice/Status/${referenceNumber}`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      }
    };

    const response = await this.httpClient.request<InvoiceStatusResponse>(requestOptions);
    return response.data;
  }

  // Private helper methods

  private prepareInvoiceRequest(invoiceXml: string): InvoiceRequest {
    if (!invoiceXml || invoiceXml.trim().length === 0) {
      throw new ValidationError('Invoice XML cannot be empty');
    }

    const hashSHA = generateSHA256Hash(invoiceXml);
    const fileSize = Buffer.byteLength(invoiceXml, 'utf8');
    const invoiceBody = toBase64(invoiceXml);

    return {
      hashSHA,
      fileSize,
      invoiceBody
    };
  }

  private async sendInvoice(
    request: InvoiceRequest,
    sessionToken: SessionToken
  ): Promise<InvoiceResponse> {
    const requestOptions: HttpRequestOptions = {
      method: 'PUT',
      url: `${this.baseUrl}/online/Invoice/Send`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      },
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<InvoiceResponse>(requestOptions);
    return response.data;
  }

  private async sendInvoicesBatch(
    request: BatchInvoiceRequest,
    sessionToken: SessionToken
  ): Promise<BatchInvoiceResponse> {
    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Invoice/SendBatch`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      },
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<BatchInvoiceResponse>(requestOptions);
    return response.data;
  }

  private async pollInvoiceStatus(
    referenceNumber: string,
    sessionToken: SessionToken,
    options: InvoiceSubmissionOptions = {}
  ): Promise<InvoiceStatusResponse> {
    const timeout = options.timeout || 300000;
    const pollInterval = options.pollInterval || 2000;
    const startTime = Date.now();

    while (true) {
      const requestOptions: HttpRequestOptions = {
        method: 'GET',
        url: `${this.baseUrl}/online/Invoice/Status/${referenceNumber}`,
        headers: {
          'SessionToken': `Token ${sessionToken.token}`
        }
      };

      const response = await this.httpClient.request<InvoiceStatusResponse>(requestOptions);
      
      if (!response || !response.data) {
        throw new ProcessError('Invalid response from KSeF server');
      }
      
      if (response.data.processingCode === 200) {
        return response.data;
      } else if (response.data.processingCode !== 100) {
        throw new ProcessError(`Invoice processing failed: ${response.data.processingDescription}`);
      }

      // Check if we've exceeded the timeout
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeout) {
        throw new ProcessError('Invoice processing timeout');
      }

      // Sleep for pollInterval or remaining time, whichever is shorter
      const remainingTime = timeout - elapsed;
      const sleepDuration = Math.min(pollInterval, remainingTime);
      await this.sleep(sleepDuration);
    }
  }

  private async pollBatchStatus(
    batchReferenceNumber: string,
    sessionToken: SessionToken,
    options: OperationOptions = {}
  ): Promise<BatchStatusResponse> {
    const timeout = options.timeout || 600000;
    const pollInterval = options.pollInterval || 5000;
    const startTime = Date.now();

    while (true) {
      const requestOptions: HttpRequestOptions = {
        method: 'GET',
        url: `${this.baseUrl}/online/Invoice/BatchStatus/${batchReferenceNumber}`,
        headers: {
          'SessionToken': `Token ${sessionToken.token}`
        }
      };

      const response = await this.httpClient.request<BatchStatusResponse>(requestOptions);
      
      if (!response || !response.data) {
        throw new ProcessError('Invalid response from KSeF server');
      }
      
      if (response.data.processingCode === 200) {
        return response.data;
      } else if (response.data.processingCode !== 100) {
        throw new ProcessError(`Batch processing failed: ${response.data.processingDescription}`);
      }

      // Check if we've exceeded the timeout
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeout) {
        throw new ProcessError('Batch processing timeout - operation did not complete within expected time');
      }

      // Sleep for pollInterval or remaining time, whichever is shorter
      const remainingTime = timeout - elapsed;
      const sleepDuration = Math.min(pollInterval, remainingTime);
      await this.sleep(sleepDuration);
    }
  }

  private async pollAsyncQueryStatus(
    referenceNumber: string,
    sessionToken: SessionToken,
    options: OperationOptions = {}
  ): Promise<AsyncQueryInvoiceStatusResponse> {
    const timeout = options.timeout || 300000;
    const pollInterval = options.pollInterval || 2000;
    const startTime = Date.now();

    while (true) {
      const requestOptions: HttpRequestOptions = {
        method: 'GET',
        url: `${this.baseUrl}/online/Invoice/QueryStatus/${referenceNumber}`,
        headers: {
          'SessionToken': `Token ${sessionToken.token}`
        }
      };

      const response = await this.httpClient.request<AsyncQueryInvoiceStatusResponse>(requestOptions);
      
      if (!response || !response.data) {
        throw new ProcessError('Invalid response from KSeF server');
      }
      
      if (response.data.processingCode === 200) {
        return response.data;
      } else if (response.data.processingCode !== 100) {
        throw new ProcessError(`Async query failed: ${response.data.processingDescription}`);
      }

      // Check if we've exceeded the timeout
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeout) {
        throw new ProcessError('Async query timeout - operation did not complete within expected time');
      }

      // Sleep for pollInterval or remaining time, whichever is shorter
      const remainingTime = timeout - elapsed;
      const sleepDuration = Math.min(pollInterval, remainingTime);
      await this.sleep(sleepDuration);
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(message: string): void {
    this.logger.debug(message);
  }
} 