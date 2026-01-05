import type { HttpClient } from '@/utils/http.js';
import { createRequestBody } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment
} from '../types/common.js';
import type {
  PermissionsOperationResponse,
  PersonPermissionsGrantRequest,
  EntityPermissionsGrantRequest,
  AttachmentStatusResponse,
  AttachmentStatus,
  IndirectPermissionsGrantRequest,
  SubunitPermissionsGrantRequest,
  EuEntityAdministrationPermissionsGrantRequest,
  EuEntityPermissionsGrantRequest,
  PermissionsOperationStatusResponse,
  PersonalPermissionsQueryRequest,
  PersonPermissionsQueryRequest,
  SubunitPermissionsQueryRequest,
  QueryPermissionsResponse
} from '../types/permissions.js';

export class PermissionsV2Service {
  private readonly baseUrl: string;

  constructor(
    private readonly httpClient: HttpClient,
    environment: ApiV2Environment
  ) {
    this.baseUrl = API_V2_BASE_URLS[environment];
  }

  async grantPersonPermissions(
    accessToken: string,
    request: PersonPermissionsGrantRequest
  ): Promise<PermissionsOperationResponse> {
    const response = await this.httpClient.request<PermissionsOperationResponse>({
      method: 'POST',
      url: `${this.baseUrl}/permissions/persons/grants`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async grantEntityPermissions(
    accessToken: string,
    request: EntityPermissionsGrantRequest
  ): Promise<PermissionsOperationResponse> {
    const response = await this.httpClient.request<PermissionsOperationResponse>({
      method: 'POST',
      url: `${this.baseUrl}/permissions/entities/grants`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async getAttachmentStatus(
    accessToken: string,
    nip?: string
  ): Promise<AttachmentStatusResponse | AttachmentStatus> {
    if (nip) {
      const response = await this.httpClient.request<AttachmentStatusResponse>({
        method: 'POST',
        url: `${this.baseUrl}/permissions/attachments/status`,
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: createRequestBody({ nip })
      });
      return response.data;
    }

    const response = await this.httpClient.request<AttachmentStatus>({
      method: 'GET',
      url: `${this.baseUrl}/permissions/attachments/status`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    return response.data;
  }

  async grantIndirectPermissions(
    accessToken: string,
    request: IndirectPermissionsGrantRequest
  ): Promise<PermissionsOperationResponse> {
    const response = await this.httpClient.request<PermissionsOperationResponse>({
      method: 'POST',
      url: `${this.baseUrl}/permissions/indirect/grants`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async grantSubunitPermissions(
    accessToken: string,
    request: SubunitPermissionsGrantRequest
  ): Promise<PermissionsOperationResponse> {
    const response = await this.httpClient.request<PermissionsOperationResponse>({
      method: 'POST',
      url: `${this.baseUrl}/permissions/subunits/grants`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async grantEuEntityAdministration(
    accessToken: string,
    request: EuEntityAdministrationPermissionsGrantRequest
  ): Promise<PermissionsOperationResponse> {
    const response = await this.httpClient.request<PermissionsOperationResponse>({
      method: 'POST',
      url: `${this.baseUrl}/permissions/eu-entities/administration/grants`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async grantEuEntityPermissions(
    accessToken: string,
    request: EuEntityPermissionsGrantRequest
  ): Promise<PermissionsOperationResponse> {
    const response = await this.httpClient.request<PermissionsOperationResponse>({
      method: 'POST',
      url: `${this.baseUrl}/permissions/eu-entities/grants`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async revokeCommonPermission(
    accessToken: string,
    permissionId: string
  ): Promise<PermissionsOperationResponse> {
    const response = await this.httpClient.request<PermissionsOperationResponse>({
      method: 'DELETE',
      url: `${this.baseUrl}/permissions/common/grants/${permissionId}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }

  async revokeAuthorizationPermission(
    accessToken: string,
    permissionId: string
  ): Promise<PermissionsOperationResponse> {
    const response = await this.httpClient.request<PermissionsOperationResponse>({
      method: 'DELETE',
      url: `${this.baseUrl}/permissions/authorizations/grants/${permissionId}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }

  async getOperationStatus(
    accessToken: string,
    referenceNumber: string
  ): Promise<PermissionsOperationStatusResponse> {
    const response = await this.httpClient.request<PermissionsOperationStatusResponse>({
      method: 'GET',
      url: `${this.baseUrl}/permissions/operations/${referenceNumber}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }

  async queryPersonalPermissions(
    accessToken: string,
    request: PersonalPermissionsQueryRequest,
    options: { pageOffset?: number; pageSize?: number } = {}
  ): Promise<QueryPermissionsResponse<any>> {
    const response = await this.httpClient.request<QueryPermissionsResponse<any>>({
      method: 'POST',
      url: `${this.baseUrl}/permissions/query/personal/grants?pageOffset=${options.pageOffset ?? 0}&pageSize=${options.pageSize ?? 10}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async queryPersonPermissions(
    accessToken: string,
    request: PersonPermissionsQueryRequest,
    options: { pageOffset?: number; pageSize?: number } = {}
  ): Promise<QueryPermissionsResponse<any>> {
    const response = await this.httpClient.request<QueryPermissionsResponse<any>>({
      method: 'POST',
      url: `${this.baseUrl}/permissions/query/persons/grants?pageOffset=${options.pageOffset ?? 0}&pageSize=${options.pageSize ?? 10}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async querySubunitPermissions(
    accessToken: string,
    request: SubunitPermissionsQueryRequest,
    options: { pageOffset?: number; pageSize?: number } = {}
  ): Promise<QueryPermissionsResponse<any>> {
    const response = await this.httpClient.request<QueryPermissionsResponse<any>>({
      method: 'POST',
      url: `${this.baseUrl}/permissions/query/subunits/grants?pageOffset=${options.pageOffset ?? 0}&pageSize=${options.pageSize ?? 10}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async queryEntityRoles(
    accessToken: string,
    options: { pageOffset?: number; pageSize?: number } = {}
  ): Promise<QueryPermissionsResponse<any>> {
    const response = await this.httpClient.request<QueryPermissionsResponse<any>>({
      method: 'GET',
      url: `${this.baseUrl}/permissions/query/entities/roles?pageOffset=${options.pageOffset ?? 0}&pageSize=${options.pageSize ?? 10}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }

  async querySubordinateEntityRoles(
    accessToken: string,
    request: SubunitPermissionsQueryRequest,
    options: { pageOffset?: number; pageSize?: number } = {}
  ): Promise<QueryPermissionsResponse<any>> {
    const response = await this.httpClient.request<QueryPermissionsResponse<any>>({
      method: 'POST',
      url: `${this.baseUrl}/permissions/query/subordinate-entities/roles?pageOffset=${options.pageOffset ?? 0}&pageSize=${options.pageSize ?? 10}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async queryAuthorizationGrants(
    accessToken: string,
    request: Record<string, unknown>,
    options: { pageOffset?: number; pageSize?: number } = {}
  ): Promise<QueryPermissionsResponse<any>> {
    const response = await this.httpClient.request<QueryPermissionsResponse<any>>({
      method: 'POST',
      url: `${this.baseUrl}/permissions/query/authorizations/grants?pageOffset=${options.pageOffset ?? 0}&pageSize=${options.pageSize ?? 10}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async queryEuEntityGrants(
    accessToken: string,
    request: Record<string, unknown>,
    options: { pageOffset?: number; pageSize?: number } = {}
  ): Promise<QueryPermissionsResponse<any>> {
    const response = await this.httpClient.request<QueryPermissionsResponse<any>>({
      method: 'POST',
      url: `${this.baseUrl}/permissions/query/eu-entities/grants?pageOffset=${options.pageOffset ?? 0}&pageSize=${options.pageSize ?? 10}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  // All test data helpers live under TestDataService to highlight their TE-only scope.
}
