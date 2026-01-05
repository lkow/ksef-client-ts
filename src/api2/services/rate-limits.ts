import type { HttpClient } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment
} from '../types/common.js';
import type {
  EffectiveApiRateLimits,
  EffectiveContextLimits,
  EffectiveSubjectLimits
} from '../types/rate-limits.js';

export class RateLimitsService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpClient: HttpClient,
    environment: ApiV2Environment
  ) {
    this.baseUrl = API_V2_BASE_URLS[environment];
  }

  async getEffectiveLimits(accessToken: string): Promise<EffectiveApiRateLimits> {
    const response = await this.httpClient.request<EffectiveApiRateLimits>({
      method: 'GET',
      url: `${this.baseUrl}/rate-limits`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }

  async getContextLimits(accessToken: string): Promise<EffectiveContextLimits> {
    const response = await this.httpClient.request<EffectiveContextLimits>({
      method: 'GET',
      url: `${this.baseUrl}/limits/context`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }

  async getSubjectLimits(accessToken: string): Promise<EffectiveSubjectLimits> {
    const response = await this.httpClient.request<EffectiveSubjectLimits>({
      method: 'GET',
      url: `${this.baseUrl}/limits/subject`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }
}
