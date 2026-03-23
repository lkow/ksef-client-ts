import type { HttpClient } from '@/utils/http.js';
import { createRequestBody } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment
} from '../types/common.js';
import { buildQueryString } from '@/utils/http.js';
import { Routes } from '../routes.js';
import type {
  PermissionsOperationResponse,
  PersonPermissionsGrantRequest,
  EntityPermissionsGrantRequest,
  CheckAttachmentPermissionStatusResponse,
  IndirectPermissionsGrantRequest,
  SubunitPermissionsGrantRequest,
  EuEntityAdministrationPermissionsGrantRequest,
  EuEntityPermissionsGrantRequest,
  EntityAuthorizationPermissionsGrantRequest,
  PermissionsOperationStatusResponse,
  PersonalPermissionsQueryRequest,
  PersonPermissionsQueryRequest,
  EntityPermissionsQueryRequest,
  SubunitPermissionsQueryRequest,
  QueryPermissionsResponse,
  EntityAuthorizationPermissionsQueryRequest,
  QueryEntityAuthorizationPermissionsResponse,
  PersonalPermission
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
      url: `${this.baseUrl}${Routes.Permissions.grantPersons}`,
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
      url: `${this.baseUrl}${Routes.Permissions.grantEntities}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async grantAuthorizationPermissions(
    accessToken: string,
    request: EntityAuthorizationPermissionsGrantRequest
  ): Promise<PermissionsOperationResponse> {
    const response = await this.httpClient.request<PermissionsOperationResponse>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.Permissions.grantAuthorizations}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async getAttachmentStatus(
    accessToken: string
  ): Promise<CheckAttachmentPermissionStatusResponse> {
    const response = await this.httpClient.request<CheckAttachmentPermissionStatusResponse>({
      method: 'GET',
      url: `${this.baseUrl}${Routes.Permissions.attachmentStatus}`,
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
      url: `${this.baseUrl}${Routes.Permissions.grantIndirect}`,
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
      url: `${this.baseUrl}${Routes.Permissions.grantSubunits}`,
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
      url: `${this.baseUrl}${Routes.Permissions.grantEuEntitiesAdministration}`,
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
      url: `${this.baseUrl}${Routes.Permissions.grantEuEntities}`,
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
      url: `${this.baseUrl}${Routes.Permissions.revokeCommon(permissionId)}`,
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
      url: `${this.baseUrl}${Routes.Permissions.revokeAuthorization(permissionId)}`,
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
      url: `${this.baseUrl}${Routes.Permissions.operationStatus(referenceNumber)}`,
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
  ): Promise<QueryPermissionsResponse<PersonalPermission>> {
    const query = buildQueryString({
      pageOffset: options.pageOffset ?? 0,
      pageSize: options.pageSize ?? 10
    });
    const response = await this.httpClient.request<QueryPermissionsResponse<PersonalPermission>>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.Permissions.queryPersonal}${query}`,
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
    const query = buildQueryString({
      pageOffset: options.pageOffset ?? 0,
      pageSize: options.pageSize ?? 10
    });
    const response = await this.httpClient.request<QueryPermissionsResponse<any>>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.Permissions.queryPersons}${query}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async queryEntityGrants(
    accessToken: string,
    request: EntityPermissionsQueryRequest,
    options: { pageOffset?: number; pageSize?: number } = {}
  ): Promise<QueryPermissionsResponse<any>> {
    const query = buildQueryString({
      pageOffset: options.pageOffset ?? 0,
      pageSize: options.pageSize ?? 10
    });
    const response = await this.httpClient.request<QueryPermissionsResponse<any>>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.Permissions.queryEntitiesGrants}${query}`,
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
    const query = buildQueryString({
      pageOffset: options.pageOffset ?? 0,
      pageSize: options.pageSize ?? 10
    });
    const response = await this.httpClient.request<QueryPermissionsResponse<any>>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.Permissions.querySubunits}${query}`,
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
    const query = buildQueryString({
      pageOffset: options.pageOffset ?? 0,
      pageSize: options.pageSize ?? 10
    });
    const response = await this.httpClient.request<QueryPermissionsResponse<any>>({
      method: 'GET',
      url: `${this.baseUrl}${Routes.Permissions.queryEntityRoles}${query}`,
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
    const query = buildQueryString({
      pageOffset: options.pageOffset ?? 0,
      pageSize: options.pageSize ?? 10
    });
    const response = await this.httpClient.request<QueryPermissionsResponse<any>>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.Permissions.querySubordinateEntityRoles}${query}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async queryAuthorizationGrants(
    accessToken: string,
    request: EntityAuthorizationPermissionsQueryRequest,
    options: { pageOffset?: number; pageSize?: number } = {}
  ): Promise<QueryEntityAuthorizationPermissionsResponse> {
    const query = buildQueryString({
      pageOffset: options.pageOffset ?? 0,
      pageSize: options.pageSize ?? 10
    });
    const response = await this.httpClient.request<QueryEntityAuthorizationPermissionsResponse>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.Permissions.queryAuthorizationGrants}${query}`,
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
    const query = buildQueryString({
      pageOffset: options.pageOffset ?? 0,
      pageSize: options.pageSize ?? 10
    });
    const response = await this.httpClient.request<QueryPermissionsResponse<any>>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.Permissions.queryEuEntityGrants}${query}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  // All test data helpers live under TestDataService to highlight their TE-only scope.
}
