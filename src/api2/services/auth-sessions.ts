import type { HttpClient, HttpRequestOptions } from '@/utils/http.js';
import { buildQueryString } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment
} from '../types/common.js';
import type { AuthenticationListResponse, AuthenticationListResponseRev2 } from '../types/auth-session.js';
import { Routes } from '../routes.js';

export interface ListSessionsOptions {
  continuationToken?: string;
  pageSize?: number;
}

export class AuthSessionService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpClient: HttpClient,
    environment: ApiV2Environment
  ) {
    this.baseUrl = API_V2_BASE_URLS[environment];
  }

  async listSessions(
    token: string,
    options: ListSessionsOptions = {}
  ): Promise<AuthenticationListResponse> {
    const query = options.pageSize ? buildQueryString({ pageSize: options.pageSize }) : '';
    return this.listSessionsAt<AuthenticationListResponse>(
      `${this.baseUrl}${Routes.AuthSessions.root}${query}`,
      token,
      options.continuationToken
    );
  }

  /** Lists active sessions on environments that support rev2. */
  async listSessionsRev2(
    token: string,
    options: ListSessionsOptions = {}
  ): Promise<AuthenticationListResponseRev2> {
    const query = buildQueryString({ pageSize: options.pageSize });
    return this.listSessionsAt<AuthenticationListResponseRev2>(
      `${this.baseUrl}${Routes.AuthSessions.rootRev2}${query}`,
      token,
      options.continuationToken,
      { skipAuthRetry: true }
    );
  }

  private async listSessionsAt<T>(
    url: string,
    token: string,
    continuationToken?: string,
    authOptions: Pick<HttpRequestOptions, 'skipAuthRetry'> = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
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

  async revokeCurrentSession(token: string): Promise<void> {
    await this.httpClient.request({
      method: 'DELETE',
      url: `${this.baseUrl}${Routes.AuthSessions.current}`,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  async revokeSession(token: string, referenceNumber: string): Promise<void> {
    await this.httpClient.request({
      method: 'DELETE',
      url: `${this.baseUrl}${Routes.AuthSessions.byReference(referenceNumber)}`,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }
}
