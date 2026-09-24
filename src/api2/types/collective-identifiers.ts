/** Payment information attached to an invoice in a collective identifier. */
export interface CollectiveIdentifierInvoicePayment {
  amount: number;
  /** Three-letter currency code accepted by the KSeF CurrencyCode dictionary. */
  currency: string;
}

export interface CollectiveIdentifierInvoice {
  ksefNumber: string;
  payment?: CollectiveIdentifierInvoicePayment | null;
  /** Maximum 512 characters. */
  description?: string | null;
}

export interface GenerateCollectiveIdentifierRequest {
  /** At least two invoices from one seller; the maximum is returned by GET /limits/context. */
  invoices: CollectiveIdentifierInvoice[];
}

export interface GenerateCollectiveIdentifierResponse {
  collectiveIdentifierNumber: string;
}

export interface CollectiveIdentifierPaginationOptions {
  /** Pass the previous response's continuationToken unchanged. */
  continuationToken?: string;
  /** 10–200, or 10–500 for queryInvoices. The API default is 10. */
  pageSize?: number;
}

export interface CollectiveIdentifiersQueryRequest {
  collectiveIdentifierNumber?: string | null;
  /** ISO 8601 date-time; the interval must not exceed 100 days. */
  dateCreatedFrom: string;
  dateCreatedTo: string;
  invoiceCountFrom?: number | null;
  invoiceCountTo?: number | null;
  createdInCurrentContext?: boolean | null;
}

export interface CollectiveIdentifiersQueryResponseItem {
  collectiveIdentifierNumber: string;
  dateCreated: string;
  invoiceCount: number;
  createdInCurrentContext: boolean;
}

export interface CollectiveIdentifiersQueryResponse {
  continuationToken?: string | null;
  collectiveIdentifiers: CollectiveIdentifiersQueryResponseItem[];
}

export interface CollectiveIdentifierInvoicesQueryRequest {
  /** Up to ten collective identifier numbers. */
  collectiveIdentifierNumbers: string[];
}

export interface CollectiveIdentifierInvoicesQueryResponseItem {
  ksefNumber: string;
  collectiveIdentifierNumber: string;
  /** True when payment/description are withheld because the caller lacks access. */
  detailsHidden: boolean;
  payment?: CollectiveIdentifierInvoicePayment | null;
  description?: string | null;
}

export interface CollectiveIdentifierInvoicesQueryResponse {
  continuationToken?: string | null;
  invoices: CollectiveIdentifierInvoicesQueryResponseItem[];
}

export interface CollectiveIdentifiersByKsefNumberQueryResponseItem {
  collectiveIdentifierNumber: string;
  createdInCurrentContext: boolean;
  dateCreated: string;
}

export interface CollectiveIdentifiersByKsefNumberQueryResponse {
  continuationToken?: string | null;
  collectiveIdentifiers: CollectiveIdentifiersByKsefNumberQueryResponseItem[];
}
