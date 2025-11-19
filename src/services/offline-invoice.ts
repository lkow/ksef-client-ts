/**
 * Offline invoice service for KSeF
 * Handles invoice generation and submission for offline modes
 * 
 * Based on:
 * - https://github.com/CIRFMF/ksef-docs/blob/main/tryby-offline.md
 * - https://github.com/CIRFMF/ksef-docs/blob/main/certyfikaty-KSeF.md
 */

import type { SessionToken } from '@/types/auth.js';
import type {
  OfflineMode,
  OfflineInvoiceInputData,
  OfflineInvoiceMetadata,
  OfflineInvoiceOptions,
  OfflineInvoiceBatchOptions,
  OfflineInvoiceBatchResult,
  OfflineInvoiceSubmissionResult,
  OfflineInvoiceStorage
} from '@/types/offline.js';
import {
  OfflineInvoiceStatus,
  InMemoryOfflineInvoiceStorage,
  calculateOfflineDeadline,
  isOfflineInvoiceExpired,
  getTimeUntilDeadline,
  getDefaultOfflineReason
} from '@/types/offline.js';
import type { InvoiceQRCodeData } from '@/types/qr-code.js';
import { QRCodeService } from './qr-code.js';
import { InvoiceService } from './invoice.js';
import { Logger } from '@/utils/logger.js';
import { ValidationError, ProcessError } from '@/types/common.js';
import type { HttpClient } from '@/utils/http.js';

export class OfflineInvoiceService {
  private qrCodeService: QRCodeService;
  private invoiceService: InvoiceService;
  private storage: OfflineInvoiceStorage;
  private logger: Logger;
  private environment: 'test' | 'prod';

  constructor(
    httpClient: HttpClient,
    baseUrl: string,
    storage?: OfflineInvoiceStorage,
    environment: 'test' | 'prod' = 'prod',
    debug = false
  ) {
    this.qrCodeService = new QRCodeService(environment, debug);
    this.invoiceService = new InvoiceService(httpClient, baseUrl, debug);
    this.storage = storage || new InMemoryOfflineInvoiceStorage();
    this.environment = environment;
    this.logger = new Logger({
      debug,
      prefix: '[OfflineInvoice]'
    });
  }

  /**
   * Generate offline invoice with QR codes
   * This can be done immediately without KSeF API access
   * 
   * @param invoiceXml - The complete FA(3) invoice XML
   * @param invoiceData - Structured invoice metadata (number, date, parties, amounts)
   * @param options - Optional configuration (mode, certificate, QR options, etc.)
   */
  async generateOfflineInvoice(
    invoiceXml: string,
    invoiceData: OfflineInvoiceInputData,
    options: OfflineInvoiceOptions = {}
  ): Promise<OfflineInvoiceMetadata> {
    const mode = options.mode || 'offline24';
    
    this.logger.debug(`Generating offline invoice in ${mode} mode`, {
      invoiceNumber: invoiceData.invoiceNumber
    });

    // Validate invoice data
    this.validateOfflineInvoiceData(invoiceData, mode);

    // Generate unique ID
    const id = this.generateInvoiceId(invoiceData.invoiceNumber);

    // Determine reason for offline generation
    const reason = options.reason || getDefaultOfflineReason(mode);

    // Calculate deadline
    const generatedAt = new Date();
    const submitBy = options.customDeadline 
      ? (typeof options.customDeadline === 'string' ? new Date(options.customDeadline) : options.customDeadline)
      : calculateOfflineDeadline(mode, generatedAt);

    // Generate QR codes if requested
    let qrCodes;
    if (options.generateQRCodes !== false) {
      // Construct minimal QR code data from input
      const qrCodeData: InvoiceQRCodeData = {
        invoiceXml,
        invoiceDate: invoiceData.invoiceDate,
        sellerNip: invoiceData.sellerIdentifier.value, // Extract NIP/PESEL value
        isOffline: true // Marking as offline invoice
      };

      // Generate QR codes (KOD I + KOD II)
      qrCodes = await this.qrCodeService.generateInvoiceQRCodes(
        qrCodeData,
        options.offlineCertificate, // Pass offline certificate for KOD II
        options.qrCodeOptions
      );
    } else {
      throw new ValidationError('QR codes are required for offline invoices');
    }

    // Create metadata
    const metadata: OfflineInvoiceMetadata = {
      id,
      mode,
      reason,
      invoiceNumber: invoiceData.invoiceNumber,
      invoiceXml,
      sellerIdentifier: invoiceData.sellerIdentifier,
      ...(invoiceData.buyerIdentifier && { buyerIdentifier: invoiceData.buyerIdentifier }),
      qrCodes,
      generatedAt: generatedAt.toISOString(),
      submitBy: submitBy.toISOString(),
      ...(options.maintenanceWindowId && { maintenanceWindowId: options.maintenanceWindowId }),
      status: OfflineInvoiceStatus.GENERATED
    };

    // Save to storage
    await this.storage.save(metadata);

    this.logger.debug('Offline invoice generated', {
      id,
      invoiceNumber: invoiceData.invoiceNumber,
      submitBy: metadata.submitBy
    });

    return metadata;
  }

  /**
   * Submit a single offline invoice to KSeF
   */
  async submitOfflineInvoice(
    invoiceId: string,
    sessionToken: SessionToken
  ): Promise<OfflineInvoiceSubmissionResult> {
    this.logger.debug(`Submitting offline invoice: ${invoiceId}`);

    // Get invoice from storage
    const invoice = await this.storage.get(invoiceId);
    if (!invoice) {
      throw new ValidationError(`Offline invoice not found: ${invoiceId}`);
    }

    // Check if expired
    if (isOfflineInvoiceExpired(invoice.submitBy)) {
      await this.storage.update(invoiceId, {
        status: OfflineInvoiceStatus.EXPIRED
      });
      
      return {
        id: invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        success: false,
        error: {
          code: 'SUBMISSION_EXPIRED',
          message: `Invoice submission deadline passed: ${invoice.submitBy}`
        },
        timestamp: new Date().toISOString()
      };
    }

    // Update status to queued
    await this.storage.update(invoiceId, {
      status: OfflineInvoiceStatus.QUEUED
    });

    try {
      // Submit to KSeF
      const result = await this.invoiceService.submitInvoice(
        invoice.invoiceXml,
        sessionToken
      );

      // Update status to submitted/accepted
      await this.storage.update(invoiceId, {
        status: OfflineInvoiceStatus.SUBMITTED,
        ksefReferenceNumber: result.ksefReferenceNumber,
        submittedAt: new Date().toISOString()
      });

      // Check if accepted
      if (result.status === 'ACCEPTED') {
        await this.storage.update(invoiceId, {
          status: OfflineInvoiceStatus.ACCEPTED
        });
      }

      this.logger.debug('Offline invoice submitted successfully', {
        id: invoiceId,
        ksefReferenceNumber: result.ksefReferenceNumber
      });

      return {
        id: invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        success: true,
        ksefReferenceNumber: result.ksefReferenceNumber,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.debug(`Failed to submit offline invoice: ${invoiceId}`, error);

      // Update status to rejected
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.storage.update(invoiceId, {
        status: OfflineInvoiceStatus.REJECTED,
        error: {
          code: 'SUBMISSION_FAILED',
          message: errorMessage,
          details: error
        }
      });

      return {
        id: invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        success: false,
        error: {
          code: 'SUBMISSION_FAILED',
          message: errorMessage
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Submit multiple offline invoices in batch
   */
  async submitOfflineInvoicesBatch(
    sessionToken: SessionToken,
    options: OfflineInvoiceBatchOptions = {}
  ): Promise<OfflineInvoiceBatchResult> {
    this.logger.debug('Starting offline invoice batch submission');

    // Get invoices to submit
    const filter: any = {};
    if (options.statusFilter) {
      filter.status = options.statusFilter;
    } else {
      // By default, submit generated and queued invoices
      filter.status = [OfflineInvoiceStatus.GENERATED, OfflineInvoiceStatus.QUEUED];
    }

    // Filter by expiry if specified
    if (options.expiringWithinHours) {
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + options.expiringWithinHours);
      filter.expiringBefore = expiryDate.toISOString();
    }

    const invoices = await this.storage.list(filter);
    this.logger.debug(`Found ${invoices.length} offline invoices to submit`);

    if (invoices.length === 0) {
      return {
        total: 0,
        submitted: 0,
        accepted: 0,
        rejected: 0,
        failed: 0,
        expired: 0,
        results: []
      };
    }

    // Sort by deadline (most urgent first)
    invoices.sort((a, b) => 
      new Date(a.submitBy).getTime() - new Date(b.submitBy).getTime()
    );

    // Process in batches
    const batchSize = options.batchSize || 100;
    const results: OfflineInvoiceSubmissionResult[] = [];
    const continueOnError = options.continueOnError !== false;

    let submitted = 0;
    let accepted = 0;
    let rejected = 0;
    let failed = 0;
    let expired = 0;

    for (let i = 0; i < invoices.length; i += batchSize) {
      const batch = invoices.slice(i, i + batchSize);
      
      for (const invoice of batch) {
        const result = await this.submitOfflineInvoice(invoice.id, sessionToken);
        results.push(result);

        if (result.success) {
          submitted++;
          if (result.ksefReferenceNumber) {
            accepted++;
          }
        } else {
          if (result.error?.code === 'SUBMISSION_EXPIRED') {
            expired++;
          } else {
            failed++;
          }
          
          if (!continueOnError) {
            this.logger.debug('Batch submission stopped due to error');
            break;
          }
        }
      }
    }

    const batchResult: OfflineInvoiceBatchResult = {
      total: invoices.length,
      submitted,
      accepted,
      rejected,
      failed,
      expired,
      results
    };

    this.logger.debug('Offline invoice batch submission completed', {
      total: batchResult.total,
      submitted: batchResult.submitted,
      accepted: batchResult.accepted,
      failed: batchResult.failed,
      expired: batchResult.expired
    });

    return batchResult;
  }

  /**
   * Get offline invoice by ID
   */
  async getOfflineInvoice(id: string): Promise<OfflineInvoiceMetadata | null> {
    return await this.storage.get(id);
  }

  /**
   * List offline invoices
   */
  async listOfflineInvoices(filter?: {
    status?: OfflineInvoiceStatus[];
    mode?: OfflineMode;
  }): Promise<OfflineInvoiceMetadata[]> {
    return await this.storage.list(filter);
  }

  /**
   * Get invoices expiring soon
   */
  async getExpiringSoon(hoursUntilExpiry: number = 2): Promise<OfflineInvoiceMetadata[]> {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + hoursUntilExpiry);

    return await this.storage.list({
      expiringBefore: expiryDate.toISOString(),
      status: [OfflineInvoiceStatus.GENERATED, OfflineInvoiceStatus.QUEUED]
    });
  }

  /**
   * Delete offline invoice
   */
  async deleteOfflineInvoice(id: string): Promise<void> {
    await this.storage.delete(id);
    this.logger.debug(`Deleted offline invoice: ${id}`);
  }

  // Private helper methods

  private validateOfflineInvoiceData(data: OfflineInvoiceInputData, mode: OfflineMode): void {
    if (!data.invoiceNumber) {
      throw new ValidationError('Invoice number is required');
    }

    if (!data.invoiceDate) {
      throw new ValidationError('Invoice date is required');
    }

    if (!data.sellerIdentifier) {
      throw new ValidationError('Seller identifier is required');
    }

    if (data.totalAmount === undefined || data.totalAmount === null) {
      throw new ValidationError('Total amount is required');
    }

    if (!data.currency) {
      throw new ValidationError('Currency is required');
    }
  }

  private generateInvoiceId(invoiceNumber: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `offline-${invoiceNumber}-${timestamp}-${random}`;
  }

  /**
   * Get storage instance
   */
  getStorage(): OfflineInvoiceStorage {
    return this.storage;
  }

  /**
   * Set storage instance
   */
  setStorage(storage: OfflineInvoiceStorage): void {
    this.storage = storage;
    this.logger.debug('Offline invoice storage updated');
  }
}

