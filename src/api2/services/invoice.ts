import type { HttpClient } from '@/utils/http.js';
import { buildQueryString, createRequestBody } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment
} from '../types/common.js';
import type { EncryptedInvoicePayload } from '../crypto/encryption.js';
import type {
  ExportInvoicesResponse,
  InvoiceExportRequest,
  InvoiceExportStatusResponse,
  InvoiceQueryFilters,
  QueryInvoicesMetadataResponse,
  SendInvoiceResponse,
  SortOrder
} from '../types/invoice.js';

export class InvoiceV2Service {
  private readonly baseUrl: string;

  constructor(
    private readonly httpClient: HttpClient,
    environment: ApiV2Environment
  ) {
    this.baseUrl = API_V2_BASE_URLS[environment];
  }

  async sendInvoice(
    accessToken: string,
    sessionReferenceNumber: string,
    payload: EncryptedInvoicePayload
  ): Promise<SendInvoiceResponse> {
    const response = await this.httpClient.request<SendInvoiceResponse>({
      method: 'POST',
      url: `${this.baseUrl}/sessions/online/${sessionReferenceNumber}/invoices`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(payload)
    });

    return response.data;
  }

  async queryMetadata(
    accessToken: string,
    filters: InvoiceQueryFilters,
    options: { pageOffset?: number; pageSize?: number; sortOrder?: SortOrder } = {}
  ): Promise<QueryInvoicesMetadataResponse> {
    const query = buildQueryString({
      pageOffset: options.pageOffset,
      pageSize: options.pageSize,
      sortOrder: options.sortOrder
    });
    const response = await this.httpClient.request<QueryInvoicesMetadataResponse>({
      method: 'POST',
      url: `${this.baseUrl}/invoices/query/metadata${query}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(filters)
    });

    return response.data;
  }

  async exportInvoices(
    accessToken: string,
    request: InvoiceExportRequest
  ): Promise<ExportInvoicesResponse> {
    const response = await this.httpClient.request<ExportInvoicesResponse>({
      method: 'POST',
      url: `${this.baseUrl}/invoices/exports`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async getInvoiceExportStatus(
    accessToken: string,
    referenceNumber: string
  ): Promise<InvoiceExportStatusResponse> {
    const response = await this.httpClient.request<InvoiceExportStatusResponse>({
      method: 'GET',
      url: `${this.baseUrl}/invoices/exports/${referenceNumber}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }
}
