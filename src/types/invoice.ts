/**
 * Invoice related types and interfaces
 */

import type { StatusInfo, ContextIdentifier } from './common.js';

export interface InvoiceRequest {
  hashSHA: string;
  fileSize: number;
  invoiceBody: string; // Base64 encoded XML
}

export interface InvoiceResponse {
  elementReferenceNumber: string;
  processingCode: number;
  processingDescription: string;
  referenceNumber: string;
  timestamp: string;
}

export interface InvoiceMetadata {
  ksefNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  acquisitionDate: string;
  seller: InvoiceMetadataSeller;
  buyer: InvoiceMetadataBuyer;
  grossAmount: number;
  netAmount: number;
  vatAmount: number;
  currency: string;
  formCode: string;
  invoiceType: InvoiceType;
  invoicingMode: InvoicingMode;
  isHidden: boolean;
  isSelfInvoicing: boolean;
}

export interface InvoiceMetadataSeller {
  identifier: ContextIdentifier;
  name?: string;
  tradeName?: string;
}

export interface InvoiceMetadataBuyer {
  identifierType: string;
  identifier?: string;
  name?: string;
}

export enum InvoiceType {
  VAT = 'VAT',
  UE = 'UE',
  DOMESTIC = 'DOMESTIC'
}

export enum InvoicingMode {
  INTERACTIVE = 'INTERACTIVE',
  BATCH = 'BATCH'
}

export enum Status {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  PENDING = 'PENDING'
}

export interface InvoiceStatusResponse {
  referenceNumber: string;
  processingCode: number;
  processingDescription: string;
  timestamp: string;
  acquisitionTimestamp?: string;
  ksefReferenceNumber?: string;
  status?: Status;
}

export interface UpoResponse {
  upo: Uint8Array; // UPO document content
  fileName?: string;
  contentType?: string;
}

export interface GetInvoiceRequest {
  ksefReferenceNumber: string;
}

export interface GetInvoiceResponse {
  invoiceBody: string; // Base64 encoded XML
  invoiceMetadata: InvoiceMetadata;
}

export interface DateRange {
  dateType: DateType;
  from: string;
  to: string;
}

export enum DateType {
  INVOICE_DATE = 'INVOICE_DATE',
  ACQUISITION_DATE = 'ACQUISITION_DATE'
}

export interface AmountFilter {
  amountType: AmountType;
  from?: number;
  to?: number;
}

export enum AmountType {
  GROSS = 'GROSS',
  NET = 'NET',
  VAT = 'VAT'
}

export interface QueryInvoiceRequest {
  subjectType: SubjectType;
  dateRange: DateRange;
  ksefNumber?: string;
  invoiceNumber?: string;
  amount?: AmountFilter;
  seller?: InvoiceQuerySeller;
  buyer?: InvoiceQueryBuyer;
  currencyCodes?: string[];
  pageSize?: number;
  pageOffset?: number;
}

export enum SubjectType {
  SUBJECT1 = 'subject1',
  SUBJECT2 = 'subject2',
  SUBJECT3 = 'subject3'
}

export interface InvoiceQuerySeller {
  identifier?: ContextIdentifier;
  name?: string;
}

export interface InvoiceQueryBuyer {
  identifier?: ContextIdentifier;
  name?: string;
}

export interface PagedInvoiceResponse {
  invoiceMetadataList: InvoiceMetadata[];
  numberOfElements: number;
  pageOffset: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

export interface AsyncQueryInvoiceRequest extends QueryInvoiceRequest {
  queryType?: 'SYNCHRONOUS' | 'ASYNCHRONOUS';
}

export interface AsyncQueryInvoiceResponse {
  elementReferenceNumber: string;
  processingCode: number;
  processingDescription: string;
  referenceNumber: string;
  timestamp: string;
}

export interface AsyncQueryInvoiceStatusResponse {
  referenceNumber: string;
  processingCode: number;
  processingDescription: string;
  timestamp: string;
  result?: PagedInvoiceResponse;
}

export interface BatchInvoiceRequest {
  invoices: InvoiceRequest[];
  batchSize?: number;
}

export interface BatchInvoiceResponse {
  batchReferenceNumber: string;
  invoiceResponses: InvoiceResponse[];
  status: StatusInfo;
}

export interface BatchStatusResponse {
  batchReferenceNumber: string;
  processingCode: number;
  processingDescription: string;
  timestamp: string;
  processedCount: number;
  totalCount: number;
  invoiceStatuses: InvoiceStatusResponse[];
}

export interface InvoiceSubmissionResult {
  ksefReferenceNumber: string;
  referenceNumber: string;
  acquisitionTimestamp: string;
  status: Status;
  upo?: Uint8Array;
}

export interface BatchSubmissionResult {
  batchReferenceNumber: string;
  totalCount: number;
  successCount: number;
  failureCount: number;
  results: InvoiceSubmissionResult[];
}

export interface BatchSessionRequest {
  keepSessionOpen: boolean;
}

export interface BatchSessionResponse {
  referenceNumber: string;
  sessionToken: string;
  status: StatusInfo;
}

export interface CloseBatchRequest {
  referenceNumber: string;
}

export interface BatchStatus {
  processingCode: number;
  processingDescription: string;
  referenceNumber: string;
  invoiceCount?: number;
  successCount?: number;
  errorCount?: number;
} 