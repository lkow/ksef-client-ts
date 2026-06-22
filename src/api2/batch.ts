import { createCipheriv, createHash } from 'node:crypto';
import { gzipSync, constants as zlibConstants } from 'node:zlib';
import type { HttpClient } from '@/utils/http.js';
import type {
  ApiV2Environment,
  BatchFileInfo,
  BatchFilePartInfo,
  CompressionType,
  FormCode,
  PartUploadRequest
} from './types/common.js';
import type { SymmetricKeyMaterial } from './crypto/symmetric.js';
import { SymmetricKeyManager } from './crypto/symmetric.js';
import { SecurityService } from './security.js';
import type {
  SessionInvoicesResponse,
  SessionInvoiceStatus,
  SessionStatusResponse
} from './types/session.js';
import {
  BatchSessionUploader,
  type OpenBatchSessionOptions,
  type OpenBatchSessionResult,
  SessionV2Service
} from './services/sessions.js';

export interface BatchFileBuildResult {
  batchFile: BatchFileInfo;
  parts: Buffer[];
}

export interface BatchInvoiceInput {
  localId: string;
  fileName: string;
  xml: string | Buffer;
}

export interface BatchManifestItem {
  localId: string;
  fileName: string;
  invoiceHash: string;
  invoiceSize: number;
}

export interface BatchPrepareOptions {
  formCode: FormCode;
  invoices: BatchInvoiceInput[];
  /**
   * High-level preparation currently builds tar.gz archives. The low-level
   * helpers remain available for callers that already own another archive.
   */
  compression?: Extract<CompressionType, 'TarGz'>;
  /** KSeF limit: parts are split before encryption and cannot exceed 100 MB. */
  partSizeBytes?: number;
  encryptionMaterial?: SymmetricKeyMaterial;
}

export interface PreparedBatch {
  formCode: FormCode;
  compressionType: Extract<CompressionType, 'TarGz'>;
  batchFile: BatchFileInfo;
  encryptedParts: Buffer[];
  manifest: BatchManifestItem[];
  encryptionMaterial: SymmetricKeyMaterial;
  archiveSize: number;
  archiveHash: string;
  partSizeBytes: number;
}

export interface BatchSubmitOptions {
  uploadConcurrency?: number;
  closeSession?: boolean;
  session?: Omit<OpenBatchSessionOptions, 'encryptionMaterial'>;
}

export interface SubmittedBatch {
  referenceNumber: string;
  session: OpenBatchSessionResult;
  batchFile: BatchFileInfo;
  manifest: BatchManifestItem[];
  partUploadRequests: PartUploadRequest[];
}

export interface BatchWaitForCompletionOptions {
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  isTerminal?: (status: SessionStatusResponse) => boolean;
}

export interface BatchListOptions {
  pageSize?: number;
}

export interface BatchCorrelatedResult {
  localId: string;
  fileName: string;
  invoiceHash: string;
  invoiceSize: number;
  sessionInvoice: SessionInvoiceStatus;
}

export interface BatchResultCorrelation {
  matched: BatchCorrelatedResult[];
  unmatchedSessionInvoices: SessionInvoiceStatus[];
  missingManifestItems: BatchManifestItem[];
}

export class BatchFileBuilder {
  constructor(private readonly buffer: Buffer) {}

  build(
    partSize = 5 * 1024 * 1024,
    options: { compressionType?: CompressionType | null } = {}
  ): BatchFileBuildResult {
    const parts: Buffer[] = [];
    const partInfos: BatchFilePartInfo[] = [];

    for (let offset = 0, ordinal = 1; offset < this.buffer.length; offset += partSize, ordinal++) {
      const part = this.buffer.subarray(offset, Math.min(offset + partSize, this.buffer.length));
      parts.push(part);
      partInfos.push({
        ordinalNumber: ordinal,
        fileSize: part.byteLength,
        fileHash: sha256Base64(part)
      });
    }

    return {
      batchFile: {
        fileSize: this.buffer.byteLength,
        fileHash: sha256Base64(this.buffer),
        ...(options.compressionType ? { compressionType: options.compressionType } : {}),
        fileParts: partInfos
      },
      parts
    };
  }
}

export function sha256Base64(buffer: Buffer): string {
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('base64');
}

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
    const manifestByHash = new Map(manifest.map((item) => [item.invoiceHash, item]));
    const matched: BatchCorrelatedResult[] = [];
    const unmatchedSessionInvoices: SessionInvoiceStatus[] = [];
    const matchedHashes = new Set<string>();

    for (const sessionInvoice of sessionInvoices) {
      const manifestItem = manifestByHash.get(sessionInvoice.invoiceHash);
      if (!manifestItem) {
        unmatchedSessionInvoices.push(sessionInvoice);
        continue;
      }
      matched.push({
        localId: manifestItem.localId,
        fileName: manifestItem.fileName,
        invoiceHash: manifestItem.invoiceHash,
        invoiceSize: manifestItem.invoiceSize,
        sessionInvoice
      });
      matchedHashes.add(manifestItem.invoiceHash);
    }

    return {
      matched,
      unmatchedSessionInvoices,
      missingManifestItems: manifest.filter((item) => !matchedHashes.has(item.invoiceHash))
    };
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

function buildManifest(invoices: BatchInvoiceInput[]): BatchManifestItem[] {
  return invoices.map((invoice) => {
    const invoiceBuffer = toBuffer(invoice.xml);
    return {
      localId: invoice.localId,
      fileName: normalizeTarFileName(invoice.fileName),
      invoiceHash: sha256Base64(invoiceBuffer),
      invoiceSize: invoiceBuffer.byteLength
    };
  });
}

function buildTarGz(invoices: BatchInvoiceInput[]): Buffer {
  const tarEntries: Buffer[] = [];

  for (const invoice of invoices) {
    const fileName = normalizeTarFileName(invoice.fileName);
    const content = toBuffer(invoice.xml);
    tarEntries.push(createTarHeader(fileName, content.byteLength));
    tarEntries.push(content);
    const padding = (512 - (content.byteLength % 512)) % 512;
    if (padding > 0) {
      tarEntries.push(Buffer.alloc(padding));
    }
  }

  tarEntries.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(tarEntries), {
    level: zlibConstants.Z_BEST_COMPRESSION
  });
}

function createTarHeader(fileName: string, size: number): Buffer {
  const header = Buffer.alloc(512, 0);
  header.write(fileName, 0, 100, 'utf8');
  writeTarOctal(header, 0o644, 100, 8);
  writeTarOctal(header, 0, 108, 8);
  writeTarOctal(header, 0, 116, 8);
  writeTarOctal(header, size, 124, 12);
  writeTarOctal(header, 0, 136, 12);
  header.fill(0x20, 148, 156);
  header.write('0', 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');

  let checksum = 0;
  for (const byte of header) {
    checksum += byte;
  }
  const checksumValue = checksum.toString(8).padStart(6, '0');
  header.write(`${checksumValue}\0 `, 148, 8, 'ascii');
  return header;
}

function writeTarOctal(header: Buffer, value: number, offset: number, length: number): void {
  const valueString = value.toString(8);
  if (valueString.length > length - 1) {
    throw new Error(`Tar header value ${value} does not fit in ${length} bytes`);
  }
  header.write(`${valueString.padStart(length - 1, '0')}\0`, offset, length, 'ascii');
}

function splitBuffer(buffer: Buffer, partSizeBytes: number): Buffer[] {
  const parts: Buffer[] = [];
  for (let offset = 0; offset < buffer.length; offset += partSizeBytes) {
    parts.push(buffer.subarray(offset, Math.min(offset + partSizeBytes, buffer.length)));
  }
  return parts;
}

function encryptPart(part: Buffer, encryptionMaterial: SymmetricKeyMaterial): Buffer {
  const cipher = createCipheriv(
    'aes-256-cbc',
    encryptionMaterial.symmetricKey,
    encryptionMaterial.initializationVector
  );
  return Buffer.concat([cipher.update(part), cipher.final()]);
}

function toBuffer(value: string | Buffer): Buffer {
  return Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
}

function normalizeTarFileName(fileName: string): string {
  const normalized = fileName.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('..') || normalized.includes('\0')) {
    throw new Error(`Invalid invoice fileName: ${fileName}`);
  }
  if (Buffer.byteLength(normalized, 'utf8') > 100) {
    throw new Error(`Invoice fileName is too long for the built-in tar writer: ${fileName}`);
  }
  return normalized;
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

function mergeSessionInvoices(
  invoices: SessionInvoiceStatus[],
  failedInvoices: SessionInvoiceStatus[]
): SessionInvoiceStatus[] {
  const merged = new Map<string, SessionInvoiceStatus>();
  for (const invoice of [...invoices, ...failedInvoices]) {
    merged.set(invoice.referenceNumber || `${invoice.invoiceHash}:${invoice.ordinalNumber}`, invoice);
  }
  return Array.from(merged.values());
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
