import type { BatchFileInfo, CompressionType, FormCode, PartUploadRequest } from '../types/common.js';
import type { SymmetricKeyMaterial } from '../crypto/symmetric.js';
import type { SessionInvoiceStatus, SessionStatusResponse } from '../types/session.js';
import type { OpenBatchSessionOptions, OpenBatchSessionResult } from '../services/sessions.js';

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
  /**
   * Safety cap for the buffered prepare flow, measured as tar size before gzip.
   * Defaults to 256 MiB. Raise only when the caller controls process memory.
   */
  maxUncompressedArchiveSizeBytes?: number;
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
