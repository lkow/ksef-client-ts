/**
 * Tests for PermissionsService
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { PermissionsService } from '../src/services/permissions.js';
import { ProcessError } from '../src/types/common.js';
import type { SessionToken } from '../src/types/auth.js';
import type { ContextIdentifier } from '../src/types/common.js';
import type { 
  GrantPermissionsResponse,
  RevokePermissionsResponse,
  QueryPermissionsResponse,
  PermissionStatusResponse
} from '../src/types/permissions.js';
import { PermissionStatus, RoleType } from '../src/types/permissions.js';

// Mock the http utils
vi.mock('../src/utils/http.js', () => ({
  createRequestBody: vi.fn((data) => JSON.stringify(data))
}));

describe('PermissionsService', () => {
  let permissionsService: PermissionsService;
  let mockHttpClient: any;
  let mockSessionToken: SessionToken;
  let mockContextIdentifier: ContextIdentifier;
  let mockSubjectIdentifier: ContextIdentifier;

  beforeEach(() => {
    mockHttpClient = {
      request: vi.fn()
    };

    mockSessionToken = {
      token: 'mock-session-token',
      context: {
        contextIdentifier: { type: 'onip', value: '1234567890' },
        credentialsRoleList: ['ADMIN']
      }
    };

    mockContextIdentifier = {
      type: 'onip',
      value: '1234567890'
    };

    mockSubjectIdentifier = {
      type: 'pesel',
      value: '12345678901'
    };

    permissionsService = new PermissionsService(mockHttpClient, 'https://test.ksef.mf.gov.pl/api/v2', true);
  });

  describe('Constructor', () => {
    it('should initialize with correct parameters', () => {
      expect(permissionsService).toBeDefined();
    });

    it('should handle debug mode correctly', () => {
      const debugService = new PermissionsService(mockHttpClient, 'https://test.ksef.mf.gov.pl/api/v2', true);
      const nonDebugService = new PermissionsService(mockHttpClient, 'https://test.ksef.mf.gov.pl/api/v2', false);
      
      expect(debugService).toBeDefined();
      expect(nonDebugService).toBeDefined();
    });
  });

  describe('grantPermission', () => {
         it('should grant permission successfully (immediate success)', async () => {
       const roleType: RoleType = RoleType.INVOICE_WRITE;
      
      const mockGrantResponse: GrantPermissionsResponse = {
        elementReferenceNumber: 'grant-ref-123',
        status: {
          processingCode: 200,
          processingDescription: 'Permission granted',
          referenceNumber: 'status-ref-123',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockGrantResponse });

      await permissionsService.grantPermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        roleType,
        mockSessionToken
      );

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://test.ksef.mf.gov.pl/api/v2/online/Credentials/Grant',
          headers: {
            'SessionToken': 'Token mock-session-token'
          }
        })
      );
    });

    it('should grant permission successfully (with polling)', async () => {
      const roleType: RoleType = RoleType.INVOICE_WRITE;
      
      const mockGrantResponse: GrantPermissionsResponse = {
        elementReferenceNumber: 'grant-ref-456',
        status: {
          processingCode: 100,
          processingDescription: 'Processing',
          referenceNumber: 'status-ref-456',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      const mockStatusResponse: PermissionStatusResponse = {
        processingCode: 200,
        processingDescription: 'Permission granted successfully',
        referenceNumber: 'status-ref-456',
        timestamp: '2024-01-15T10:31:00Z'
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockGrantResponse }) // Grant request
        .mockResolvedValueOnce({ data: mockStatusResponse }); // Status polling

      await permissionsService.grantPermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        roleType,
        mockSessionToken
      );

      expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
    });

    it('should handle permission grant failure', async () => {
      const roleType: RoleType = RoleType.INVOICE_WRITE;
      
      const mockGrantResponse: GrantPermissionsResponse = {
        elementReferenceNumber: 'grant-ref-fail',
        status: {
          processingCode: 400,
          processingDescription: 'Permission grant failed',
          referenceNumber: 'status-ref-fail',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockGrantResponse });

      await expect(permissionsService.grantPermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        roleType,
        mockSessionToken
      )).rejects.toThrow(ProcessError);
    });

    it('should handle HTTP errors during grant', async () => {
      const roleType: RoleType = RoleType.INVOICE_WRITE;

      mockHttpClient.request.mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(permissionsService.grantPermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        roleType,
        mockSessionToken
      )).rejects.toThrow('Unauthorized');
    });

    it('should handle polling timeout', async () => {
      const roleType: RoleType = RoleType.INVOICE_WRITE;
      
      const mockGrantResponse: GrantPermissionsResponse = {
        elementReferenceNumber: 'grant-ref-timeout',
        status: {
          processingCode: 100,
          processingDescription: 'Processing',
          referenceNumber: 'status-ref-timeout',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      const mockPendingStatus: PermissionStatusResponse = {
        processingCode: 100,
        processingDescription: 'Still processing',
        referenceNumber: 'status-ref-timeout',
        timestamp: '2024-01-15T10:31:00Z'
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockGrantResponse })
        .mockResolvedValue({ data: mockPendingStatus }); // Always pending

      await expect(permissionsService.grantPermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        roleType,
        mockSessionToken,
        { timeout: 1000 }
      )).rejects.toThrow(ProcessError);
    });

    it('should handle polling failure', async () => {
      const roleType: RoleType = RoleType.INVOICE_WRITE;
      
      const mockGrantResponse: GrantPermissionsResponse = {
        elementReferenceNumber: 'grant-ref-poll-fail',
        status: {
          processingCode: 100,
          processingDescription: 'Processing',
          referenceNumber: 'status-ref-poll-fail',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      const mockFailureStatus: PermissionStatusResponse = {
        processingCode: 400,
        processingDescription: 'Permission grant failed during processing',
        referenceNumber: 'status-ref-poll-fail',
        timestamp: '2024-01-15T10:31:00Z'
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockGrantResponse })
        .mockResolvedValueOnce({ data: mockFailureStatus });

      await expect(permissionsService.grantPermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        roleType,
        mockSessionToken
      )).rejects.toThrow(ProcessError);
    });
  });

  describe('revokePermission', () => {
    it('should revoke permission successfully (immediate success)', async () => {
      const mockRevokeResponse: RevokePermissionsResponse = {
        elementReferenceNumber: 'revoke-ref-123',
        status: {
          processingCode: 200,
          processingDescription: 'Permission revoked',
          referenceNumber: 'status-ref-123',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockRevokeResponse });

      await permissionsService.revokePermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        mockSessionToken
      );

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://test.ksef.mf.gov.pl/api/v2/online/Credentials/Revoke',
          headers: {
            'SessionToken': 'Token mock-session-token'
          }
        })
      );
    });

    it('should revoke permission successfully (with polling)', async () => {
      const mockRevokeResponse: RevokePermissionsResponse = {
        elementReferenceNumber: 'revoke-ref-456',
        status: {
          processingCode: 100,
          processingDescription: 'Processing',
          referenceNumber: 'status-ref-456',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      const mockStatusResponse: PermissionStatusResponse = {
        processingCode: 200,
        processingDescription: 'Permission revoked successfully',
        referenceNumber: 'status-ref-456',
        timestamp: '2024-01-15T10:31:00Z'
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockRevokeResponse }) // Revoke request
        .mockResolvedValueOnce({ data: mockStatusResponse }); // Status polling

      await permissionsService.revokePermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        mockSessionToken
      );

      expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
    });

    it('should handle permission revoke failure', async () => {
      const mockRevokeResponse: RevokePermissionsResponse = {
        elementReferenceNumber: 'revoke-ref-fail',
        status: {
          processingCode: 400,
          processingDescription: 'Permission revocation failed',
          referenceNumber: 'status-ref-fail',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockRevokeResponse });

      await expect(permissionsService.revokePermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        mockSessionToken
      )).rejects.toThrow(ProcessError);
    });

    it('should handle HTTP errors during revoke', async () => {
      mockHttpClient.request.mockRejectedValueOnce(new Error('Permission not found'));

      await expect(permissionsService.revokePermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        mockSessionToken
      )).rejects.toThrow('Permission not found');
    });
  });

  describe('queryPermissions', () => {
    it('should query permissions successfully', async () => {
      const mockQueryResponse: QueryPermissionsResponse = {
        permissions: [
          {
            subjectIdentifier: mockSubjectIdentifier,
            roleType: RoleType.INVOICE_WRITE,
            contextIdentifier: mockContextIdentifier,
            grantedTimestamp: '2024-01-15T10:30:00Z',
            status: PermissionStatus.ACTIVE
          }
        ],
        status: {
            processingCode: 200,
            processingDescription: 'Permission granted',
            referenceNumber: 'status-ref-123',
            timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockQueryResponse });

      const result = await permissionsService.queryPermissions(
        mockContextIdentifier,
        mockSessionToken
      );

      expect(result).toEqual(mockQueryResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://test.ksef.mf.gov.pl/api/v2/online/Credentials/Query',
          headers: {
            'SessionToken': 'Token mock-session-token'
          }
        })
      );
    });

    it('should query permissions for specific subject', async () => {
      const mockQueryResponse: QueryPermissionsResponse = {
        permissions: [
          {
            subjectIdentifier: mockSubjectIdentifier,
            roleType: RoleType.INVOICE_WRITE,
            contextIdentifier: mockContextIdentifier,
            grantedTimestamp: '2024-01-15T10:30:00Z',
            status: PermissionStatus.ACTIVE
          }
        ],
        status: {
            processingCode: 200,
            processingDescription: 'Permission granted',
            referenceNumber: 'status-ref-123',
            timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockQueryResponse });

      const result = await permissionsService.queryPermissions(
        mockContextIdentifier,
        mockSessionToken,
        mockSubjectIdentifier
      );

      expect(result).toEqual(mockQueryResponse);
      
      // Verify that subjectIdentifier was included in the request
      const requestCall = mockHttpClient.request.mock.calls[0][0];
      const requestBody = JSON.parse(requestCall.body);
      expect(requestBody).toHaveProperty('subjectIdentifier', mockSubjectIdentifier);
    });

    it('should handle empty permissions query', async () => {
      const mockQueryResponse: QueryPermissionsResponse = {
        permissions: [],
        status: {
            processingCode: 200,
            processingDescription: 'Permission granted',
            referenceNumber: 'status-ref-123',
            timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockQueryResponse });

      const result = await permissionsService.queryPermissions(
        mockContextIdentifier,
        mockSessionToken
      );

      expect(result.permissions).toHaveLength(0);
    });

    it('should handle query errors', async () => {
      const unauthorizedError = new Error('Insufficient permissions');
      (unauthorizedError as any).status = 403;
      mockHttpClient.request.mockRejectedValueOnce(unauthorizedError);

      await expect(permissionsService.queryPermissions(
        mockContextIdentifier,
        mockSessionToken
      )).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('getPermissionStatus', () => {
    it('should get permission status successfully', async () => {
      const referenceNumber = 'status-ref-123';
      
      const mockStatusResponse: PermissionStatusResponse = {
        processingCode: 200,
        processingDescription: 'Operation completed',
        referenceNumber,
        timestamp: '2024-01-15T10:31:00Z'
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockStatusResponse });

      const result = await permissionsService.getPermissionStatus(referenceNumber, mockSessionToken);

      expect(result).toEqual(mockStatusResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: `https://test.ksef.mf.gov.pl/api/v2/online/Credentials/Status/${referenceNumber}`,
          headers: {
            'SessionToken': 'Token mock-session-token'
          }
        })
      );
    });

    it('should handle status not found', async () => {
      const referenceNumber = 'invalid-ref';

      const notFoundError = new Error('Reference not found');
      (notFoundError as any).status = 404;
      mockHttpClient.request.mockRejectedValueOnce(notFoundError);

      await expect(permissionsService.getPermissionStatus(referenceNumber, mockSessionToken))
        .rejects.toThrow('Reference not found');
    });
  });

  describe('Different Role Types', () => {
    it('should handle different role types correctly', async () => {
      const roleTypes: RoleType[] = [RoleType.INVOICE_WRITE, RoleType.INVOICE_READ, RoleType.SELF_INVOICING, RoleType.PAYMENT_CONFIRMATION, RoleType.TAX_REPRESENTATIVE];

      for (const roleType of roleTypes) {
        const mockGrantResponse: GrantPermissionsResponse = {
          elementReferenceNumber: `grant-ref-${roleType}`,
          status: {
            processingCode: 200,
            processingDescription: `${roleType} permission granted`,
            referenceNumber: `status-ref-${roleType}`,
            timestamp: '2024-01-15T10:30:00Z'
          }
        };

        mockHttpClient.request.mockResolvedValueOnce({ data: mockGrantResponse });

        await permissionsService.grantPermission(
          mockContextIdentifier,
          mockSubjectIdentifier,
          roleType,
          mockSessionToken
        );

        const requestCall = mockHttpClient.request.mock.calls[mockHttpClient.request.mock.calls.length - 1][0];
        const requestBody = JSON.parse(requestCall.body);
        expect(requestBody).toHaveProperty('roleType', roleType);
      }
    });
  });

  describe('Different Context Types', () => {
    it('should handle NIP to PESEL permission grant', async () => {
      const nipContext: ContextIdentifier = { type: 'onip', value: '1234567890' };
      const peselSubject: ContextIdentifier = { type: 'pesel', value: '12345678901' };

      const mockGrantResponse: GrantPermissionsResponse = {
        elementReferenceNumber: 'grant-ref-nip-pesel',
        status: {
          processingCode: 200,
          processingDescription: 'Permission granted',
          referenceNumber: 'status-ref-nip-pesel',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockGrantResponse });

      await permissionsService.grantPermission(
        nipContext,
        peselSubject,
        'USER',
        mockSessionToken
      );

      const requestCall = mockHttpClient.request.mock.calls[0][0];
      const requestBody = JSON.parse(requestCall.body);
      expect(requestBody).toHaveProperty('contextIdentifier', nipContext);
      expect(requestBody).toHaveProperty('subjectIdentifier', peselSubject);
    });

    it('should handle PESEL to PESEL permission grant', async () => {
      const peselContext: ContextIdentifier = { type: 'pesel', value: '11111111111' };
      const peselSubject: ContextIdentifier = { type: 'pesel', value: '22222222222' };

      const mockGrantResponse: GrantPermissionsResponse = {
        elementReferenceNumber: 'grant-ref-pesel-pesel',
        status: {
          processingCode: 200,
          processingDescription: 'Permission granted',
          referenceNumber: 'status-ref-pesel-pesel',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockGrantResponse });

      await permissionsService.grantPermission(
        peselContext,
        peselSubject,
        'USER',
        mockSessionToken
      );

      const requestCall = mockHttpClient.request.mock.calls[0][0];
      const requestBody = JSON.parse(requestCall.body);
      expect(requestBody).toHaveProperty('contextIdentifier', peselContext);
      expect(requestBody).toHaveProperty('subjectIdentifier', peselSubject);
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP 401 errors', async () => {
      const unauthorizedError = new Error('Unauthorized');
      (unauthorizedError as any).status = 401;
      mockHttpClient.request.mockRejectedValueOnce(unauthorizedError);

      await expect(permissionsService.grantPermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        'USER',
        mockSessionToken
      )).rejects.toThrow('Unauthorized');
    });

    it('should handle HTTP 500 errors', async () => {
      const serverError = new Error('Internal Server Error');
      (serverError as any).status = 500;
      mockHttpClient.request.mockRejectedValueOnce(serverError);

      await expect(permissionsService.grantPermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        'USER',
        mockSessionToken
      )).rejects.toThrow('Internal Server Error');
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'TIMEOUT';
      mockHttpClient.request.mockRejectedValueOnce(timeoutError);

      await expect(permissionsService.grantPermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        'USER',
        mockSessionToken
      )).rejects.toThrow('Request timeout');
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed status responses during polling', async () => {
      const mockGrantResponse: GrantPermissionsResponse = {
        elementReferenceNumber: 'grant-ref-malformed',
        status: {
          processingCode: 100,
          processingDescription: 'Processing',
          referenceNumber: 'status-ref-malformed',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockGrantResponse })
        .mockResolvedValueOnce({ data: null }); // Malformed response

      await expect(permissionsService.grantPermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        'USER',
        mockSessionToken
      )).rejects.toThrow();
    });

    it('should handle very long permission descriptions', async () => {
      const longDescription = 'Permission granted with very long description that exceeds normal limits ' + 'x'.repeat(1000);
      
      const mockGrantResponse: GrantPermissionsResponse = {
        elementReferenceNumber: 'grant-ref-long',
        status: {
          processingCode: 200,
          processingDescription: longDescription,
          referenceNumber: 'status-ref-long',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockGrantResponse });

      await expect(permissionsService.grantPermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        'USER',
        mockSessionToken
      )).resolves.not.toThrow();
    });

    it('should handle session token with different context types in token context', async () => {
      const peselSessionToken: SessionToken = {
        token: 'pesel-session-token',
        context: {
          contextIdentifier: { type: 'pesel', value: '12345678901' },
          credentialsRoleList: ['ADMIN']
        }
      };

      const mockGrantResponse: GrantPermissionsResponse = {
        elementReferenceNumber: 'grant-ref-pesel-token',
        status: {
          processingCode: 200,
          processingDescription: 'Permission granted',
          referenceNumber: 'status-ref-pesel-token',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockHttpClient.request.mockResolvedValueOnce({ data: mockGrantResponse });

      await permissionsService.grantPermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        'USER',
        peselSessionToken
      );

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'SessionToken': 'Token pesel-session-token'
          }
        })
      );
    });

    it('should handle custom operation options', async () => {
      const mockGrantResponse: GrantPermissionsResponse = {
        elementReferenceNumber: 'grant-ref-options',
        status: {
          processingCode: 100,
          processingDescription: 'Processing',
          referenceNumber: 'status-ref-options',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      const mockStatusResponse: PermissionStatusResponse = {
        processingCode: 200,
        processingDescription: 'Permission granted',
        referenceNumber: 'status-ref-options',
        timestamp: '2024-01-15T10:31:00Z'
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockGrantResponse })
        .mockResolvedValueOnce({ data: mockStatusResponse });

      await permissionsService.grantPermission(
        mockContextIdentifier,
        mockSubjectIdentifier,
        'USER',
        mockSessionToken,
        { timeout: 60000, pollInterval: 1000 }
      );

      expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
    });
  });
});
