import type { HttpClient } from '@/utils/http.js';
import { createRequestBody, buildQueryString } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment,
  type TokenReferenceNumber
} from '../types/common.js';
import type {
  GenerateTokenRequest,
  GenerateTokenResponse,
  QueryTokensResponse,
  AuthenticationTokenStatus,
  TokenStatusResponse
} from '../types/token.js';

export interface QueryTokensOptions {
  status?: AuthenticationTokenStatus[];
  description?: string;
  authorIdentifier?: string;
  authorIdentifierType?: string;
  pageSize?: number;
  continuationToken?: string;
}

export class TokenService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpClient: HttpClient,
    environment: ApiV2Environment
  ) {
    this.baseUrl = API_V2_BASE_URLS[environment];
  }

  async generateToken(
    accessToken: string,
    request: GenerateTokenRequest
  ): Promise<GenerateTokenResponse> {
    const response = await this.httpClient.request<GenerateTokenResponse>({
      method: 'POST',
      url: `${this.baseUrl}/tokens`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async queryTokens(
    accessToken: string,
    options: QueryTokensOptions = {}
  ): Promise<QueryTokensResponse> {
    const query = buildQueryString({
      status: options.status,
      description: options.description,
      authorIdentifier: options.authorIdentifier,
      authorIdentifierType: options.authorIdentifierType,
      pageSize: options.pageSize
    });

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`
    };
    if (options.continuationToken) {
      headers['x-continuation-token'] = options.continuationToken;
    }

    const response = await this.httpClient.request<QueryTokensResponse>({
      method: 'GET',
      url: `${this.baseUrl}/tokens${query}`,
      headers
    });

    return response.data;
  }

  async getToken(
    accessToken: string,
    referenceNumber: TokenReferenceNumber
  ): Promise<TokenStatusResponse> {
    const response = await this.httpClient.request<TokenStatusResponse>({
      method: 'GET',
      url: `${this.baseUrl}/tokens/${referenceNumber}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }

  async revokeToken(accessToken: string, referenceNumber: TokenReferenceNumber): Promise<void> {
    await this.httpClient.request({
      method: 'DELETE',
      url: `${this.baseUrl}/tokens/${referenceNumber}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  }
}
