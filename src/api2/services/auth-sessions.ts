import type { HttpClient } from '@/utils/http.js';
import { buildQueryString } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment
} from '../types/common.js';
import type { AuthenticationListResponse } from '../types/auth-session.js';

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
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    };
    if (options.continuationToken) {
      headers['x-continuation-token'] = options.continuationToken;
    }

    const response = await this.httpClient.request<AuthenticationListResponse>({
      method: 'GET',
      url: `${this.baseUrl}/auth/sessions${query}`,
      headers
    });
    return response.data;
  }

  async revokeCurrentSession(token: string): Promise<void> {
    await this.httpClient.request({
      method: 'DELETE',
      url: `${this.baseUrl}/auth/sessions/current`,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  async revokeSession(token: string, referenceNumber: string): Promise<void> {
    await this.httpClient.request({
      method: 'DELETE',
      url: `${this.baseUrl}/auth/sessions/${referenceNumber}`,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }
}
