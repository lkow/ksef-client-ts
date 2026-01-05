import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionsV2Service } from '../../src/api2/services/permissions.js';
import { createMockHttpClient } from '../helpers/mock-http-client.js';

describe('PermissionsV2Service', () => {
  const mockHttpClient = createMockHttpClient();

  beforeEach(() => {
    mockHttpClient.reset();
  });

  describe('grantPersonPermissions', () => {
    it('calls POST /permissions/persons/grants', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'perm-ref-123',
        status: 'Pending'
      });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.grantPersonPermissions('token', {
        subjectIdentifier: { type: 'Pesel', value: '12345678901' },
        permissions: ['InvoiceRead'],
        description: 'Grant invoice read',
        subjectDetails: {
          subjectDetailsType: 'PersonByIdentifier',
          personById: {
            firstName: 'Jan',
            lastName: 'Kowalski'
          }
        }
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/permissions/persons/grants');
      expect(request?.headers?.['Authorization']).toBe('Bearer token');
    });
  });

  describe('grantEntityPermissions', () => {
    it('calls POST /permissions/entities/grants', async () => {
      mockHttpClient.mockResponse({ referenceNumber: 'ent-ref' });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.grantEntityPermissions('token', {
        subjectIdentifier: { type: 'Nip', value: '1111111111' },
        permissions: [{ type: 'InvoiceRead', canDelegate: true }],
        description: 'Grant invoice read',
        subjectDetails: { fullName: 'Example Corp' }
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/permissions/entities/grants');
    });
  });

  describe('grantAuthorizationPermissions', () => {
    it('calls POST /permissions/authorizations/grants', async () => {
      mockHttpClient.mockResponse({ referenceNumber: 'auth-ref' });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.grantAuthorizationPermissions('token', {
        subjectIdentifier: { type: 'Nip', value: '1234567890' },
        permission: 'SelfInvoicing',
        description: 'Authorization grant',
        subjectDetails: { fullName: 'Example Entity' }
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/permissions/authorizations/grants');
      expect(request?.headers?.['Authorization']).toBe('Bearer token');
    });
  });

  describe('grantIndirectPermissions', () => {
    it('calls POST /permissions/indirect/grants', async () => {
      mockHttpClient.mockResponse({ referenceNumber: 'ind-ref' });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.grantIndirectPermissions('token', {
        subjectIdentifier: { type: 'Pesel', value: '12345678901' },
        targetIdentifier: { type: 'AllPartners' },
        permissions: ['InvoiceRead'],
        description: 'Indirect invoice read',
        subjectDetails: {
          subjectDetailsType: 'PersonByIdentifier',
          personById: {
            firstName: 'Anna',
            lastName: 'Nowak'
          }
        }
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/permissions/indirect/grants');
    });
  });

  describe('grantSubunitPermissions', () => {
    it('calls POST /permissions/subunits/grants', async () => {
      mockHttpClient.mockResponse({ referenceNumber: 'sub-ref' });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.grantSubunitPermissions('token', {
        subjectIdentifier: { type: 'Pesel', value: '12345678901' },
        contextIdentifier: { type: 'Nip', value: '1234567890' },
        description: 'Grant subunit admin',
        subjectDetails: {
          subjectDetailsType: 'PersonByIdentifier',
          personById: {
            firstName: 'Piotr',
            lastName: 'Zielinski'
          }
        }
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('/permissions/subunits/grants');
    });
  });

  describe('grantEuEntityAdministration', () => {
    it('calls POST /permissions/eu-entities/administration/grants', async () => {
      mockHttpClient.mockResponse({ referenceNumber: 'eu-admin-ref' });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.grantEuEntityAdministration('token', {
        subjectIdentifier: { type: 'Pesel', value: '12345678901' },
        contextIdentifier: { type: 'Nip', value: '1234567890' },
        description: 'Grant EU entity admin',
        euEntityName: 'EU Entity',
        subjectDetails: {
          subjectDetailsType: 'PersonByFingerprintWithIdentifier',
          personByFpWithId: {
            firstName: 'Maria',
            lastName: 'Kowalska',
            identifier: { type: 'Pesel', value: '12345678901' }
          }
        },
        euEntityDetails: {
          fullName: 'EU Entity Sp. z o.o.',
          address: 'Main Street 1, 00-001'
        }
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('/permissions/eu-entities/administration/grants');
    });
  });

  describe('grantEuEntityPermissions', () => {
    it('calls POST /permissions/eu-entities/grants', async () => {
      mockHttpClient.mockResponse({ referenceNumber: 'eu-ref' });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.grantEuEntityPermissions('token', {
        subjectIdentifier: { type: 'Fingerprint', value: 'fingerprint-value' },
        permissions: ['InvoiceRead'],
        description: 'Grant EU entity read',
        subjectDetails: {
          subjectDetailsType: 'EntityByFingerprint',
          entityByFp: {
            fullName: 'EU Entity Representative',
            address: 'Main Street 1, 00-001'
          }
        }
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('/permissions/eu-entities/grants');
    });
  });

  describe('getAttachmentStatus', () => {
    it('calls GET /permissions/attachments/status', async () => {
      mockHttpClient.mockResponse({
        isAttachmentAllowed: true,
        revokedDate: null
      });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      const result = await service.getAttachmentStatus('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/permissions/attachments/status');
      expect(result.isAttachmentAllowed).toBe(true);
    });
  });

  describe('revokeCommonPermission', () => {
    it('calls DELETE /permissions/common/grants/{id}', async () => {
      mockHttpClient.mockResponse({ referenceNumber: 'revoke-ref' });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.revokeCommonPermission('token', 'perm-id-123');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('DELETE');
      expect(request?.url).toContain('/permissions/common/grants/perm-id-123');
    });
  });

  describe('revokeAuthorizationPermission', () => {
    it('calls DELETE /permissions/authorizations/grants/{id}', async () => {
      mockHttpClient.mockResponse({ referenceNumber: 'revoke-auth-ref' });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.revokeAuthorizationPermission('token', 'auth-perm-456');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('DELETE');
      expect(request?.url).toContain('/permissions/authorizations/grants/auth-perm-456');
    });
  });

  describe('getOperationStatus', () => {
    it('calls GET /permissions/operations/{ref}', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'op-ref',
        status: 'Completed'
      });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      const result = await service.getOperationStatus('token', 'op-ref-789');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/permissions/operations/op-ref-789');
      expect(result.status).toBe('Completed');
    });
  });

  describe('queryPersonalPermissions', () => {
    it('calls POST /permissions/query/personal/grants', async () => {
      mockHttpClient.mockResponse({
        permissions: [],
        totalCount: 0
      });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.queryPersonalPermissions('token', {});

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/permissions/query/personal/grants');
    });

    it('includes pagination params', async () => {
      mockHttpClient.mockResponse({ permissions: [] });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.queryPersonalPermissions('token', {}, { pageOffset: 5, pageSize: 20 });

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('pageOffset=5');
      expect(request?.url).toContain('pageSize=20');
    });
  });

  describe('queryPersonPermissions', () => {
    it('calls POST /permissions/query/persons/grants with required queryType', async () => {
      mockHttpClient.mockResponse({ permissions: [] });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.queryPersonPermissions('token', {
        queryType: 'PermissionsInCurrentContext'
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('/permissions/query/persons/grants');
      expect(request?.body).toContain('queryType');
      expect(request?.body).toContain('PermissionsInCurrentContext');
    });
  });

  describe('querySubunitPermissions', () => {
    it('calls POST /permissions/query/subunits/grants', async () => {
      mockHttpClient.mockResponse({ permissions: [] });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.querySubunitPermissions('token', {} as any);

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('/permissions/query/subunits/grants');
    });
  });

  describe('queryEntityRoles', () => {
    it('calls GET /permissions/query/entities/roles', async () => {
      mockHttpClient.mockResponse({ permissions: [] });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.queryEntityRoles('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/permissions/query/entities/roles');
    });
  });

  describe('querySubordinateEntityRoles', () => {
    it('calls POST /permissions/query/subordinate-entities/roles', async () => {
      mockHttpClient.mockResponse({ permissions: [] });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.querySubordinateEntityRoles('token', {} as any);

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('/permissions/query/subordinate-entities/roles');
    });
  });

  describe('queryAuthorizationGrants', () => {
    it('calls POST /permissions/query/authorizations/grants', async () => {
      mockHttpClient.mockResponse({ authorizationGrants: [], hasMore: false });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.queryAuthorizationGrants('token', {
        queryType: 'Granted'
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('/permissions/query/authorizations/grants');
      expect(request?.body).toContain('queryType');
      expect(request?.body).toContain('Granted');
    });
  });

  describe('queryEuEntityGrants', () => {
    it('calls POST /permissions/query/eu-entities/grants', async () => {
      mockHttpClient.mockResponse({ permissions: [] });

      const service = new PermissionsV2Service(mockHttpClient as any, 'test');

      await service.queryEuEntityGrants('token', {});

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('/permissions/query/eu-entities/grants');
    });
  });

  describe('environment URLs', () => {
    it('uses correct base URL for each environment', async () => {
      mockHttpClient.mockResponse({ permissions: [] });

      const testService = new PermissionsV2Service(mockHttpClient as any, 'test');
      await testService.queryPersonalPermissions('token', {});
      expect(mockHttpClient.getLastRequest()?.url).toContain('api-test.ksef.mf.gov.pl');

      mockHttpClient.reset();
      mockHttpClient.mockResponse({ permissions: [] });

      const prodService = new PermissionsV2Service(mockHttpClient as any, 'prod');
      await prodService.queryPersonalPermissions('token', {});
      expect(mockHttpClient.getLastRequest()?.url).toContain('api.ksef.mf.gov.pl');
    });
  });
});
