import type { HttpClient } from '@/utils/http.js';
import { createRequestBody } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment
} from '../types/common.js';
import type {
  TestDataPermissionsGrantRequest,
  TestDataPermissionsRevokeRequest,
  AttachmentPermissionGrantRequest,
  AttachmentPermissionRevokeRequest,
  SubjectCreateRequest,
  SubjectRemoveRequest,
  PersonCreateRequest,
  PersonRemoveRequest,
  SetSessionLimitsRequest,
  SetSubjectLimitsRequest,
  SetRateLimitsRequest
} from '../types/test-data.js';

/**
 * Thin wrapper for `/api/v2/testdata/**` endpoints described in
 * https://github.com/CIRFMF/ksef-docs/blob/main/dane-testowe-scenariusze.md .
 * These endpoints exist only in TE, so the service throws when instantiated for production.
 */
export class TestDataService {
  private readonly baseUrl: string;
  private readonly isTestEnvironment: boolean;

  constructor(
    private readonly httpClient: HttpClient,
    environment: ApiV2Environment
  ) {
    this.baseUrl = API_V2_BASE_URLS[environment];
    this.isTestEnvironment = environment === 'test';
  }

  private ensureTestEnvironment(): void {
    if (!this.isTestEnvironment) {
      throw new Error('Test data APIs are available only on the TE environment.');
    }
  }

  async grantPermissions(request: TestDataPermissionsGrantRequest): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/testdata/permissions`,
      body: createRequestBody(request)
    });
  }

  async revokePermissions(request: TestDataPermissionsRevokeRequest): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/testdata/permissions/revoke`,
      body: createRequestBody(request)
    });
  }

  async enableAttachments(request: AttachmentPermissionGrantRequest): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/testdata/attachment`,
      body: createRequestBody(request)
    });
  }

  async disableAttachments(request: AttachmentPermissionRevokeRequest): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/testdata/attachment/revoke`,
      body: createRequestBody(request)
    });
  }

  async createSubject(request: SubjectCreateRequest): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/testdata/subject`,
      body: createRequestBody(request)
    });
  }

  async removeSubject(request: SubjectRemoveRequest): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/testdata/subject/remove`,
      body: createRequestBody(request)
    });
  }

  async createPerson(request: PersonCreateRequest): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/testdata/person`,
      body: createRequestBody(request)
    });
  }

  async removePerson(request: PersonRemoveRequest): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/testdata/person/remove`,
      body: createRequestBody(request)
    });
  }

  async setSessionLimits(accessToken: string, request: SetSessionLimitsRequest): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/testdata/limits/context/session`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });
  }

  async resetSessionLimits(accessToken: string): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'DELETE',
      url: `${this.baseUrl}/testdata/limits/context/session`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  }

  async setSubjectLimits(accessToken: string, request: SetSubjectLimitsRequest): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/testdata/limits/subject/certificate`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });
  }

  async resetSubjectLimits(accessToken: string): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'DELETE',
      url: `${this.baseUrl}/testdata/limits/subject/certificate`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  }

  async setRateLimits(accessToken: string, request: SetRateLimitsRequest): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/testdata/rate-limits`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });
  }

  async resetRateLimits(accessToken: string): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'DELETE',
      url: `${this.baseUrl}/testdata/rate-limits`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  }

  async setProductionRateLimits(accessToken: string): Promise<void> {
    this.ensureTestEnvironment();
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/testdata/rate-limits/production`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  }
}
