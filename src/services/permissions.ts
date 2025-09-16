/**
 * Permissions service for KSeF API
 */

import type {
  GrantPermissionsRequest,
  GrantPermissionsResponse,
  RevokePermissionsRequest,
  RevokePermissionsResponse,
  QueryPermissionsRequest,
  QueryPermissionsResponse,
  PermissionStatusResponse,
  RoleType,
  PermissionStatus
} from '@/types/permissions.js';
import type { SessionToken } from '@/types/auth.js';
import type { ContextIdentifier } from '@/types/common.js';
import type { HttpClient, HttpRequestOptions } from '@/utils/http.js';
import type { OperationOptions } from '@/types/config.js';
import { createRequestBody } from '@/utils/http.js';
import { ProcessError } from '@/types/common.js';
import { Logger } from '@/utils/logger.js';

export class PermissionsService {
  private httpClient: HttpClient;
  private baseUrl: string;
  private debug: boolean;
  private logger: Logger;

  constructor(httpClient: HttpClient, baseUrl: string, debug = false) {
    this.httpClient = httpClient;
    this.baseUrl = baseUrl;
    this.debug = debug;
    this.logger = new Logger({
      debug,
      prefix: '[KSeF Permissions]'
    });
  }

  /**
   * Grant permissions to a user
   */
  async grantPermission(
    contextIdentifier: ContextIdentifier,
    subjectIdentifier: ContextIdentifier,
    roleType: RoleType,
    sessionToken: SessionToken,
    options: OperationOptions = {}
  ): Promise<void> {
    this.log(`Granting permission ${roleType} to ${subjectIdentifier.value}`);

    const request: GrantPermissionsRequest = {
      contextIdentifier,
      subjectIdentifier,
      roleType
    };

    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Credentials/Grant`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      },
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<GrantPermissionsResponse>(requestOptions);
    
    // Poll for completion if processing is async
    if (response.data.status.processingCode === 100) {
      await this.pollPermissionStatus(
        response.data.elementReferenceNumber,
        sessionToken,
        options
      );
    } else if (response.data.status.processingCode !== 200) {
      throw new ProcessError(`Permission grant failed: ${response.data.status.processingDescription}`);
    }

    this.log('Permission granted successfully');
  }

  /**
   * Revoke permissions from a user
   */
  async revokePermission(
    contextIdentifier: ContextIdentifier,
    subjectIdentifier: ContextIdentifier,
    sessionToken: SessionToken,
    options: OperationOptions = {}
  ): Promise<void> {
    this.log(`Revoking permissions from ${subjectIdentifier.value}`);

    const request: RevokePermissionsRequest = {
      contextIdentifier,
      subjectIdentifier
    };

    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Credentials/Revoke`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      },
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<RevokePermissionsResponse>(requestOptions);
    
    // Poll for completion if processing is async
    if (response.data.status.processingCode === 100) {
      await this.pollPermissionStatus(
        response.data.elementReferenceNumber,
        sessionToken,
        options
      );
    } else if (response.data.status.processingCode !== 200) {
      throw new ProcessError(`Permission revocation failed: ${response.data.status.processingDescription}`);
    }

    this.log('Permission revoked successfully');
  }

  /**
   * Query permissions for a context
   */
  async queryPermissions(
    contextIdentifier: ContextIdentifier,
    sessionToken: SessionToken,
    subjectIdentifier?: ContextIdentifier
  ): Promise<QueryPermissionsResponse> {
    const request: QueryPermissionsRequest = {
      contextIdentifier,
      ...(subjectIdentifier && { subjectIdentifier })
    };

    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Credentials/Query`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      },
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<QueryPermissionsResponse>(requestOptions);
    return response.data;
  }

  /**
   * Get permission status
   */
  async getPermissionStatus(
    referenceNumber: string,
    sessionToken: SessionToken
  ): Promise<PermissionStatusResponse> {
    const requestOptions: HttpRequestOptions = {
      method: 'GET',
      url: `${this.baseUrl}/online/Credentials/Status/${referenceNumber}`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      }
    };

    const response = await this.httpClient.request<PermissionStatusResponse>(requestOptions);
    return response.data;
  }

  /**
   * Poll for permission operation completion
   */
  private async pollPermissionStatus(
    referenceNumber: string,
    sessionToken: SessionToken,
    options: OperationOptions = {}
  ): Promise<void> {
    const maxAttempts = Math.ceil((options.timeout || 300000) / (options.pollInterval || 2000));
    const pollInterval = options.pollInterval || 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const statusResponse = await this.getPermissionStatus(referenceNumber, sessionToken);
      
      if (statusResponse.processingCode === 200) {
        return;
      } else if (statusResponse.processingCode !== 100) {
        throw new ProcessError(`Permission operation failed: ${statusResponse.processingDescription}`);
      }

      // Wait before next poll
      await this.sleep(pollInterval);
    }

    throw new ProcessError('Permission operation timeout - operation did not complete within expected time');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(message: string): void {
    this.logger.debug(message);
  }
} 