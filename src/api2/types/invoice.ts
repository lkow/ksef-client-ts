import type { ApiV2ResponseStatus, EncryptionInfo, FormCode, Sha256HashBase64 } from './common.js';

export interface SendInvoiceRequestPayload {
  invoiceHash: Sha256HashBase64;
  invoiceSize: number;
  encryptedInvoiceHash: Sha256HashBase64;
  encryptedInvoiceSize: number;
  encryptedInvoiceContent: string;
  offlineMode?: boolean;
  hashOfCorrectedInvoice?: Sha256HashBase64 | null;
}

export interface SendInvoiceResponse {
  referenceNumber: string;
}

export type SortOrder = 'Asc' | 'Desc';

export type InvoiceQuerySubjectType = 'Subject1' | 'Subject2' | 'Subject3' | 'SubjectAuthorized';

export type InvoiceQueryDateType = 'Issue' | 'Invoicing' | 'PermanentStorage';

export interface InvoiceQueryDateRange {
  dateType: InvoiceQueryDateType;
  from: string;
  to?: string | null;
  restrictToPermanentStorageHwmDate?: boolean | null;
}

export type AmountType = 'Brutto' | 'Netto' | 'Vat';

export interface InvoiceQueryAmount {
  type: AmountType;
  from?: number | null;
  to?: number | null;
}

export type BuyerIdentifierType = 'None' | 'Other' | 'Nip' | 'VatUe';

export interface InvoiceQueryBuyerIdentifier {
  type: BuyerIdentifierType;
  value?: string | null;
}

export type InvoiceQueryFormType = 'FA' | 'PEF' | 'RR';

export type InvoicingMode = 'Online' | 'Offline';

export type InvoiceType =
  | 'Vat'
  | 'Zal'
  | 'Kor'
  | 'Roz'
  | 'Upr'
  | 'KorZal'
  | 'KorRoz'
  | 'VatPef'
  | 'VatPefSp'
  | 'KorPef'
  | 'VatRr'
  | 'KorVatRr';

export interface InvoiceQueryFilters {
  subjectType: InvoiceQuerySubjectType;
  dateRange: InvoiceQueryDateRange;
  ksefNumber?: string | null;
  invoiceNumber?: string | null;
  amount?: InvoiceQueryAmount | null;
  sellerNip?: string | null;
  buyerIdentifier?: InvoiceQueryBuyerIdentifier | null;
  currencyCodes?: string[] | null;
  invoicingMode?: InvoicingMode | null;
  isSelfInvoicing?: boolean | null;
  formType?: InvoiceQueryFormType | null;
  invoiceTypes?: InvoiceType[] | null;
  hasAttachment?: boolean | null;
}

export interface InvoiceMetadataSeller {
  nip: string;
  name?: string | null;
}

export interface InvoiceMetadataBuyerIdentifier {
  type: BuyerIdentifierType;
  value?: string | null;
}

export interface InvoiceMetadataBuyer {
  identifier: InvoiceMetadataBuyerIdentifier;
  name?: string | null;
}

export type ThirdSubjectIdentifierType = 'Nip' | 'InternalId' | 'VatUe' | 'Other' | 'None';

export interface InvoiceMetadataThirdSubjectIdentifier {
  type: ThirdSubjectIdentifierType;
  value?: string | null;
}

export interface InvoiceMetadataThirdSubject {
  identifier: InvoiceMetadataThirdSubjectIdentifier;
  name?: string | null;
  role: number;
}

export interface InvoiceMetadataAuthorizedSubject {
  nip: string;
  name?: string | null;
  role: number;
}

export interface InvoiceMetadata {
  ksefNumber: string;
  invoiceNumber: string;
  issueDate: string;
  invoicingDate: string;
  acquisitionDate: string;
  permanentStorageDate: string;
  seller: InvoiceMetadataSeller;
  buyer: InvoiceMetadataBuyer;
  netAmount: number;
  grossAmount: number;
  vatAmount: number;
  currency: string;
  invoicingMode: InvoicingMode;
  invoiceType: InvoiceType;
  formCode: FormCode;
  isSelfInvoicing: boolean;
  hasAttachment: boolean;
  invoiceHash: Sha256HashBase64;
  hashOfCorrectedInvoice?: Sha256HashBase64 | null;
  thirdSubjects?: InvoiceMetadataThirdSubject[] | null;
  authorizedSubject?: InvoiceMetadataAuthorizedSubject | null;
}

export interface QueryInvoicesMetadataResponse {
  hasMore: boolean;
  isTruncated: boolean;
  permanentStorageHwmDate?: string | null;
  invoices: InvoiceMetadata[];
}

export interface InvoiceExportRequest {
  encryption: EncryptionInfo;
  filters: InvoiceQueryFilters;
}

export interface ExportInvoicesResponse {
  referenceNumber: string;
}

export interface InvoicePackagePart {
  ordinalNumber: number;
  partName: string;
  method: string;
  url: string;
  partSize: number;
  partHash: Sha256HashBase64;
  encryptedPartSize: number;
  encryptedPartHash: Sha256HashBase64;
  expirationDate: string;
}

export interface InvoicePackage {
  invoiceCount: number;
  size: number;
  parts: InvoicePackagePart[];
  isTruncated: boolean;
  lastIssueDate?: string | null;
  lastInvoicingDate?: string | null;
  lastPermanentStorageDate?: string | null;
  permanentStorageHwmDate?: string | null;
}

export interface InvoiceExportStatusResponse {
  status: ApiV2ResponseStatus;
  completedDate?: string | null;
  packageExpirationDate?: string | null;
  package?: InvoicePackage | null;
}
