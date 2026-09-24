import type { HttpClient } from '@/utils/http.js';
import { buildQueryString, createRequestBody } from '@/utils/http.js';
import { API_V2_BASE_URLS, type ApiV2Environment } from '../types/common.js';
import { Routes } from '../routes.js';
import type {
  CollectiveIdentifierInvoicesQueryRequest,
  CollectiveIdentifierInvoicesQueryResponse,
  CollectiveIdentifierPaginationOptions,
  CollectiveIdentifiersByKsefNumberQueryResponse,
  CollectiveIdentifiersQueryRequest,
  CollectiveIdentifiersQueryResponse,
  GenerateCollectiveIdentifierRequest,
  GenerateCollectiveIdentifierResponse
} from '../types/collective-identifiers.js';

export class CollectiveIdentifiersService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpClient: HttpClient,
    environment: ApiV2Environment
  ) {
    this.baseUrl = API_V2_BASE_URLS[environment];
  }

  /**
   * Creates an identifier for existing invoices from one seller.
   * This does not initiate or confirm a payment. No automatic retries are made:
   * after a lost response, creation may have succeeded. Reconcile before retrying.
   * The caller must supply a valid access token; refresh-on-401 is disabled here.
   */
  async generate(
    accessToken: string,
    request: GenerateCollectiveIdentifierRequest
  ): Promise<GenerateCollectiveIdentifierResponse> {
    const response = await this.httpClient.request<GenerateCollectiveIdentifierResponse>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.CollectiveIdentifiers.root}`,
      headers: this.requestHeaders(accessToken),
      body: createRequestBody(request),
      maxRetries: 0,
      skipAuthRetry: true
    });
    return response.data;
  }

  /** Returns one page of identifiers associated with the current context. */
  async query(
    accessToken: string,
    request: CollectiveIdentifiersQueryRequest,
    options: CollectiveIdentifierPaginationOptions = {}
  ): Promise<CollectiveIdentifiersQueryResponse> {
    const query = buildQueryString({ pageSize: options.pageSize });
    const response = await this.httpClient.request<CollectiveIdentifiersQueryResponse>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.CollectiveIdentifiers.query}${query}`,
      headers: this.requestHeaders(accessToken, options),
      body: createRequestBody(request)
    });
    return response.data;
  }

  /** Returns one page of invoices for up to ten identifiers, preserving hidden details. */
  async queryInvoices(
    accessToken: string,
    request: CollectiveIdentifierInvoicesQueryRequest,
    options: CollectiveIdentifierPaginationOptions = {}
  ): Promise<CollectiveIdentifierInvoicesQueryResponse> {
    const query = buildQueryString({ pageSize: options.pageSize });
    const response = await this.httpClient.request<CollectiveIdentifierInvoicesQueryResponse>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.CollectiveIdentifiers.invoices}${query}`,
      headers: this.requestHeaders(accessToken, options),
      body: createRequestBody(request)
    });
    return response.data;
  }

  /** Returns one page of identifiers containing the given KSeF invoice number. */
  async queryByKsefNumber(
    accessToken: string,
    ksefNumber: string,
    options: CollectiveIdentifierPaginationOptions = {}
  ): Promise<CollectiveIdentifiersByKsefNumberQueryResponse> {
    const query = buildQueryString({ pageSize: options.pageSize });
    const response = await this.httpClient.request<CollectiveIdentifiersByKsefNumberQueryResponse>({
      method: 'GET',
      url: `${this.baseUrl}${Routes.CollectiveIdentifiers.byKsefNumber(ksefNumber)}${query}`,
      headers: this.requestHeaders(accessToken, options)
    });
    return response.data;
  }

  private requestHeaders(
    accessToken: string,
    options: CollectiveIdentifierPaginationOptions = {}
  ): Record<string, string> {
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    if (options.continuationToken) {
      headers['x-continuation-token'] = options.continuationToken;
    }
    return headers;
  }
}
