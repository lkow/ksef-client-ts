import type { HttpClient, HttpRequestOptions } from '@/utils/http.js';
import { createRequestBody, buildQueryString } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment,
  type TokenReferenceNumber
} from '../types/common.js';
import { Routes } from '../routes.js';
import type {
  GenerateTokenRequest,
  GenerateTokenRequestRev2,
  GenerateTokenResponse,
  QueryTokensResponse,
  QueryTokensResponseRev2,
  AuthenticationTokenStatus,
  TokenAuthorIdentifierTypeFilterRev2,
  TokenStatusFilterRev2,
  TokenStatusResponse,
  TokenStatusResponseRev2
} from '../types/token.js';

export interface QueryTokensOptions {
  status?: AuthenticationTokenStatus[];
  description?: string;
  authorIdentifier?: string;
  authorIdentifierType?: string;
  pageSize?: number;
  continuationToken?: string;
}

export interface QueryTokensOptionsRev2 extends Omit<QueryTokensOptions, 'status' | 'authorIdentifierType'> {
  status?: TokenStatusFilterRev2[];
  authorIdentifierType?: TokenAuthorIdentifierTypeFilterRev2;
  /** Matches tokens whose validity starts at or after this date. */
  validFrom?: string;
  /** Matches tokens whose validity ends at or before this date. */
  validTo?: string;
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
      url: `${this.baseUrl}${Routes.Tokens.root}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  /** Issues a rev2 token once. After an uncertain result, check the token list before retrying. */
  async generateTokenRev2(
    accessToken: string,
    request: GenerateTokenRequestRev2
  ): Promise<GenerateTokenResponse> {
    const response = await this.httpClient.request<GenerateTokenResponse>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.Tokens.rootRev2}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request),
      maxRetries: 0,
      skipAuthRetry: true
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
    return this.queryTokensAt<QueryTokensResponse>(
      `${this.baseUrl}${Routes.Tokens.root}${query}`,
      accessToken,
      options.continuationToken
    );
  }

  /** Returns one page of token metadata from the rev2 endpoint. */
  async queryTokensRev2(
    accessToken: string,
    options: QueryTokensOptionsRev2 = {}
  ): Promise<QueryTokensResponseRev2> {
    const query = buildQueryString({
      status: options.status,
      description: options.description,
      authorIdentifier: options.authorIdentifier,
      authorIdentifierType: options.authorIdentifierType,
      validFrom: options.validFrom,
      validTo: options.validTo,
      pageSize: options.pageSize
    });
    return this.queryTokensAt<QueryTokensResponseRev2>(
      `${this.baseUrl}${Routes.Tokens.rootRev2}${query}`,
      accessToken,
      options.continuationToken,
      { skipAuthRetry: true }
    );
  }

  private async queryTokensAt<T>(
    url: string,
    accessToken: string,
    continuationToken?: string,
    authOptions: Pick<HttpRequestOptions, 'skipAuthRetry'> = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`
    };
    if (continuationToken) {
      headers['x-continuation-token'] = continuationToken;
    }

    const response = await this.httpClient.request<T>({
      method: 'GET',
      url,
      headers,
      ...authOptions
    });

    return response.data;
  }

  async getToken(
    accessToken: string,
    referenceNumber: TokenReferenceNumber
  ): Promise<TokenStatusResponse> {
    const response = await this.httpClient.request<TokenStatusResponse>({
      method: 'GET',
      url: `${this.baseUrl}${Routes.Tokens.byReference(referenceNumber)}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }

  /** Reads the rev2 status, including validity dates and approval state. */
  async getTokenRev2(
    accessToken: string,
    referenceNumber: TokenReferenceNumber
  ): Promise<TokenStatusResponseRev2> {
    const response = await this.httpClient.request<TokenStatusResponseRev2>({
      method: 'GET',
      url: `${this.baseUrl}${Routes.Tokens.byReferenceRev2(referenceNumber)}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      skipAuthRetry: true
    });
    return response.data;
  }

  /** Approves a pending rev2 token using an access token obtained via XAdES or Węzeł Krajowy. */
  async approveToken(accessToken: string, referenceNumber: TokenReferenceNumber): Promise<void> {
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}${Routes.Tokens.approve(referenceNumber)}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      maxRetries: 0,
      skipAuthRetry: true
    });
  }

  async revokeToken(accessToken: string, referenceNumber: TokenReferenceNumber): Promise<void> {
    await this.httpClient.request({
      method: 'DELETE',
      url: `${this.baseUrl}${Routes.Tokens.byReference(referenceNumber)}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  }
}
