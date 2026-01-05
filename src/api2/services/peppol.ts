import type { HttpClient } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment
} from '../types/common.js';
import { buildQueryString } from '@/utils/http.js';
import type { QueryPeppolProvidersResponse } from '../types/peppol.js';

export class PeppolService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpClient: HttpClient,
    environment: ApiV2Environment
  ) {
    this.baseUrl = API_V2_BASE_URLS[environment];
  }

  async queryProviders(
    accessToken: string,
    options: { pageOffset?: number; pageSize?: number } = {}
  ): Promise<QueryPeppolProvidersResponse> {
    const query = buildQueryString({
      pageOffset: options.pageOffset ?? 0,
      pageSize: options.pageSize ?? 10
    });
    const response = await this.httpClient.request<QueryPeppolProvidersResponse>({
      method: 'GET',
      url: `${this.baseUrl}/peppol/query${query}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }
}

