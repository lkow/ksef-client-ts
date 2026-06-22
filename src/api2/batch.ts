import type { HttpClient } from '@/utils/http.js';
import type {
  ApiV2Environment,
  BatchFileInfo,
  BatchFilePartInfo,
  PartUploadRequest
} from './types/common.js';
import { SymmetricKeyManager } from './crypto/symmetric.js';
import { SecurityService } from './security.js';
import type {
  SessionInvoicesResponse,
  SessionInvoiceStatus,
  SessionStatusResponse
} from './types/session.js';
import {
  BatchSessionUploader,
  SessionV2Service
} from './services/sessions.js';
import { buildManifest, buildTarGz } from './batch/archive.js';
import { encryptPart, sha256Base64 } from './batch/crypto.js';
import { correlateBatchResults, mergeSessionInvoices } from './batch/results.js';
import type {
  BatchListOptions,
  BatchManifestItem,
  BatchPrepareOptions,
  BatchResultCorrelation,
  BatchSubmitOptions,
  BatchWaitForCompletionOptions,
  PreparedBatch,
  SubmittedBatch
} from './batch/types.js';

export { BatchFileBuilder } from './batch/file-builder.js';
export { sha256Base64 } from './batch/crypto.js';
export type {
  BatchCorrelatedResult,
  BatchFileBuildResult,
  BatchInvoiceInput,
  BatchListOptions,
  BatchManifestItem,
  BatchPrepareOptions,
  BatchResultCorrelation,
  BatchSubmitOptions,
  BatchWaitForCompletionOptions,
  PreparedBatch,
  SubmittedBatch
} from './batch/types.js';

export class KsefBatchService {
  private readonly symmetricManager: SymmetricKeyManager;

  constructor(
    private readonly sessions: SessionV2Service,
    private readonly batchUploader: BatchSessionUploader,
    httpClient: HttpClient,
    environment: ApiV2Environment,
    securityService?: SecurityService
  ) {
    this.symmetricManager = new SymmetricKeyManager(
      securityService ?? new SecurityService(httpClient, environment)
    );
  }

  async prepare(options: BatchPrepareOptions): Promise<PreparedBatch> {
    const compressionType = options.compression ?? 'TarGz';
    const partSizeBytes = options.partSizeBytes ?? 100_000_000;

    if (compressionType !== 'TarGz') {
      throw new Error('High-level batch.prepare currently supports TarGz only. Use low-level helpers for custom archives.');
    }
    if (options.invoices.length === 0) {
      throw new Error('Batch must contain at least one invoice');
    }
    if (!Number.isInteger(partSizeBytes) || partSizeBytes <= 0 || partSizeBytes > 100_000_000) {
      throw new Error('partSizeBytes must be an integer between 1 and 100000000');
    }

    const manifest = buildManifest(options.invoices);
    assertUnique(manifest.map((item) => item.localId), 'localId');
    assertUnique(manifest.map((item) => item.fileName), 'fileName');
    assertUnique(manifest.map((item) => item.invoiceHash), 'invoiceHash');

    const archive = buildTarGz(options.invoices);
    const rawParts = splitBuffer(archive, partSizeBytes);
    if (rawParts.length > 50) {
      throw new Error('Batch archive exceeds KSeF limit of 50 parts');
    }

    const encryptionMaterial = options.encryptionMaterial ?? await this.symmetricManager.createMaterial();
    const encryptedParts = rawParts.map((part) => encryptPart(part, encryptionMaterial));
    const fileParts = encryptedParts.map<BatchFilePartInfo>((part, index) => ({
      ordinalNumber: index + 1,
      fileSize: part.byteLength,
      fileHash: sha256Base64(part)
    }));
    const archiveHash = sha256Base64(archive);
    const batchFile: BatchFileInfo = {
      fileSize: archive.byteLength,
      fileHash: archiveHash,
      compressionType,
      fileParts
    };

    return {
      formCode: options.formCode,
      compressionType,
      batchFile,
      encryptedParts,
      manifest,
      encryptionMaterial,
      archiveSize: archive.byteLength,
      archiveHash,
      partSizeBytes
    };
  }

  async submit(
    accessToken: string,
    prepared: PreparedBatch,
    options: BatchSubmitOptions = {}
  ): Promise<SubmittedBatch> {
    const session = await this.sessions.openBatchSession(
      accessToken,
      prepared.batchFile,
      prepared.formCode,
      {
        ...options.session,
        encryptionMaterial: prepared.encryptionMaterial
      }
    );

    await this.uploadPreparedParts(
      session.partUploadRequests,
      prepared.encryptedParts,
      options.uploadConcurrency ?? 4
    );

    if (options.closeSession !== false) {
      await this.sessions.closeBatchSession(accessToken, session.referenceNumber);
    }

    return {
      referenceNumber: session.referenceNumber,
      session,
      batchFile: prepared.batchFile,
      manifest: prepared.manifest,
      partUploadRequests: session.partUploadRequests
    };
  }

  async waitForCompletion(
    accessToken: string,
    referenceNumber: string,
    options: BatchWaitForCompletionOptions = {}
  ): Promise<SessionStatusResponse> {
    const isTerminal = options.isTerminal ?? ((status) => status.status.code >= 200);
    const startedAt = Date.now();
    const timeoutMs = options.timeoutMs ?? 15 * 60_000;
    const maxAttempts = options.maxAttempts ?? Number.POSITIVE_INFINITY;
    let delayMs = options.initialDelayMs ?? 5_000;
    const maxDelayMs = options.maxDelayMs ?? 30_000;
    const backoffFactor = options.backoffFactor ?? 1.5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const status = await this.sessions.getSessionStatus(accessToken, referenceNumber);
      if (isTerminal(status)) {
        return status;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`Batch session ${referenceNumber} did not complete within ${timeoutMs}ms`);
      }
      await sleep(delayMs);
      delayMs = Math.min(maxDelayMs, Math.ceil(delayMs * backoffFactor));
    }

    throw new Error(`Batch session ${referenceNumber} did not complete within ${maxAttempts} attempts`);
  }

  async listAllInvoices(
    accessToken: string,
    referenceNumber: string,
    options: BatchListOptions = {}
  ): Promise<SessionInvoiceStatus[]> {
    return await this.listAllSessionInvoices((continuationToken) =>
      this.sessions.listSessionInvoices(
        accessToken,
        referenceNumber,
        buildPaginationOptions(continuationToken, options.pageSize)
      )
    );
  }

  async listAllFailedInvoices(
    accessToken: string,
    referenceNumber: string,
    options: BatchListOptions = {}
  ): Promise<SessionInvoiceStatus[]> {
    return await this.listAllSessionInvoices((continuationToken) =>
      this.sessions.listFailedSessionInvoices(
        accessToken,
        referenceNumber,
        buildPaginationOptions(continuationToken, options.pageSize)
      )
    );
  }

  correlateResults(
    manifest: BatchManifestItem[],
    sessionInvoices: SessionInvoiceStatus[]
  ): BatchResultCorrelation {
    return correlateBatchResults(manifest, sessionInvoices);
  }

  async getMappedResults(
    accessToken: string,
    referenceNumber: string,
    manifest: BatchManifestItem[],
    options: BatchListOptions = {}
  ): Promise<BatchResultCorrelation> {
    const [invoices, failedInvoices] = await Promise.all([
      this.listAllInvoices(accessToken, referenceNumber, options),
      this.listAllFailedInvoices(accessToken, referenceNumber, options)
    ]);
    return this.correlateResults(manifest, mergeSessionInvoices(invoices, failedInvoices));
  }

  private async uploadPreparedParts(
    uploadRequests: PartUploadRequest[],
    encryptedParts: Buffer[],
    concurrency: number
  ): Promise<void> {
    if (!Number.isInteger(concurrency) || concurrency <= 0) {
      throw new Error('uploadConcurrency must be a positive integer');
    }

    const requestsByOrdinal = new Map(uploadRequests.map((request) => [request.ordinalNumber, request]));
    const items = encryptedParts.map((part, index) => {
      const ordinalNumber = index + 1;
      const request = requestsByOrdinal.get(ordinalNumber);
      if (!request) {
        throw new Error(`Missing upload request for batch part #${ordinalNumber}`);
      }
      return { request, part };
    });

    await runWithConcurrency(items, concurrency, async ({ request, part }) => {
      await this.batchUploader.uploadPart(request, part);
    });
  }

  private async listAllSessionInvoices(
    fetchPage: (continuationToken?: string) => Promise<SessionInvoicesResponse>
  ): Promise<SessionInvoiceStatus[]> {
    const invoices: SessionInvoiceStatus[] = [];
    const seenTokens = new Set<string>();
    let continuationToken: string | undefined;

    do {
      const page = await fetchPage(continuationToken);
      invoices.push(...page.invoices);
      continuationToken = page.continuationToken ?? undefined;
      if (continuationToken) {
        if (seenTokens.has(continuationToken)) {
          throw new Error('Session invoice pagination returned a repeated continuation token');
        }
        seenTokens.add(continuationToken);
      }
    } while (continuationToken);

    return invoices;
  }
}

function splitBuffer(buffer: Buffer, partSizeBytes: number): Buffer[] {
  const parts: Buffer[] = [];
  for (let offset = 0; offset < buffer.length; offset += partSizeBytes) {
    parts.push(buffer.subarray(offset, Math.min(offset + partSizeBytes, buffer.length)));
  }
  return parts;
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Batch contains duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex++]!;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function buildPaginationOptions(
  continuationToken: string | undefined,
  pageSize: number | undefined
): { continuationToken?: string; pageSize?: number } {
  const options: { continuationToken?: string; pageSize?: number } = {};
  if (continuationToken !== undefined) {
    options.continuationToken = continuationToken;
  }
  if (pageSize !== undefined) {
    options.pageSize = pageSize;
  }
  return options;
}

function sleep(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
