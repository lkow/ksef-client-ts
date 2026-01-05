import type { ApiV2ResponseStatus, Sha256HashBase64 } from './common.js';

export interface UpoPageResponse {
  referenceNumber: string;
  downloadUrl: string;
  downloadUrlExpirationDate: string;
}

export interface UpoResponse {
  pages: UpoPageResponse[];
}

export interface UpoDownloadResult {
  xml: string;
  hash?: string | null;
}

export interface SessionStatusResponse {
  status: ApiV2ResponseStatus;
  validUntil?: string | null;
  dateCreated?: string | null;
  dateUpdated?: string | null;
  upo?: UpoResponse | null;
  invoiceCount?: number | null;
  successfulInvoiceCount?: number | null;
  failedInvoiceCount?: number | null;
}

export interface SessionInvoiceStatus {
  ordinalNumber: number;
  invoiceNumber?: string | null;
  ksefNumber?: string | null;
  referenceNumber: string;
  invoiceHash: Sha256HashBase64;
  invoiceFileName?: string | null;
  acquisitionDate?: string | null;
  invoicingDate: string;
  permanentStorageDate?: string | null;
  upoDownloadUrl?: string | null;
  upoDownloadUrlExpirationDate?: string | null;
  invoicingMode?: string | null;
  status: ApiV2ResponseStatus;
}

export interface SessionInvoicesResponse {
  continuationToken?: string | null;
  invoices: SessionInvoiceStatus[];
}
