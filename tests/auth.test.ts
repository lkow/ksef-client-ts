/**
 * Tests for AuthenticationService
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AuthenticationService } from '../src/services/auth.js';
import { AuthenticationError, ProcessError } from '../src/types/common.js';
import type { 
  CertificateCredentials, 
  TokenCredentials, 
  AuthorisationChallengeResponse,
  SessionResponse,
  SessionToken
} from '../src/types/auth.js';
import type { ContextIdentifier } from '../src/types/common.js';

// Mock the crypto utils
vi.mock('../src/utils/crypto.js', () => ({
  parseCertificate: vi.fn(),
  validateCertificate: vi.fn(),
  createXMLSignature: vi.fn(),
  encryptTokenWithTimestamp: vi.fn()
}));

// Mock the http utils
vi.mock('../src/utils/http.js', () => ({
  createRequestBody: vi.fn((data) => JSON.stringify(data))
}));

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let mockHttpClient: any;
  let mockContextIdentifier: ContextIdentifier;
  let mockCertCredentials: CertificateCredentials;
  let mockTokenCredentials: TokenCredentials;

  beforeEach(() => {
    mockHttpClient = {
      request: vi.fn()
    };

    mockContextIdentifier = {
      type: 'onip',
      value: '1234567890'
    };

    mockCertCredentials = {
      certificate: 'mock-certificate-data',
      password: 'mock-password'
    };

    mockTokenCredentials = {
      token: 'mock-auth-token'
    };

    authService = new AuthenticationService(mockHttpClient, 'https://test.ksef.mf.gov.pl/api/v2', true);
  });

  describe('Constructor', () => {
    it('should initialize with correct parameters', () => {
      expect(authService).toBeDefined();
      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getCurrentSession()).toBeUndefined();
    });

    it('should handle debug mode correctly', () => {
      const debugService = new AuthenticationService(mockHttpClient, 'https://test.ksef.mf.gov.pl/api/v2', true);
      const nonDebugService = new AuthenticationService(mockHttpClient, 'https://test.ksef.mf.gov.pl/api/v2', false);
      
      expect(debugService).toBeDefined();
      expect(nonDebugService).toBeDefined();
    });
  });

  describe('authenticate', () => {
    it('should authenticate with certificate credentials', async () => {
      const mockSessionToken: SessionToken = {
        token: 'mock-session-token',
        context: {
          contextIdentifier: mockContextIdentifier,
          credentialsRoleList: ['USER']
        }
      };

      // Mock certificate validation
      const { parseCertificate, validateCertificate } = await import('../src/utils/crypto.js');
      (parseCertificate as Mock).mockReturnValue({ privateKey: 'mock-key', certificate: 'mock-cert' });
      (validateCertificate as Mock).mockReturnValue({ valid: true, errors: [] });

      // Mock challenge response
      const mockChallengeResponse: AuthorisationChallengeResponse = {
        challenge: 'mock-challenge',
        timestamp: '2024-01-15T10:30:00Z'
      };

      // Mock session response
      const mockSessionResponse: SessionResponse = {
        sessionToken: mockSessionToken,
        referenceNumber: 'mock-ref-123'
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockChallengeResponse }) // Challenge request
        .mockResolvedValueOnce({ data: mockSessionResponse }); // Init signed request

      const result = await authService.authenticate(mockCertCredentials, mockContextIdentifier);

      expect(result).toEqual(mockSessionToken);
      expect(authService.isAuthenticated()).toBe(true);
      expect(authService.getCurrentSession()).toEqual(mockSessionToken);
    });

    it('should authenticate with token credentials', async () => {
      const mockSessionToken: SessionToken = {
        token: 'mock-session-token',
        context: {
          contextIdentifier: mockContextIdentifier,
          credentialsRoleList: ['USER']
        }
      };

      // Mock challenge response
      const mockChallengeResponse: AuthorisationChallengeResponse = {
        challenge: 'mock-challenge',
        timestamp: '2024-01-15T10:30:00Z'
      };

      // Mock session response
      const mockSessionResponse: SessionResponse = {
        sessionToken: mockSessionToken,
        referenceNumber: 'mock-ref-456'
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: mockChallengeResponse }) // Challenge request
        .mockResolvedValueOnce({ data: mockSessionResponse }); // Init token request

      const result = await authService.authenticate(mockTokenCredentials, mockContextIdentifier);

      expect(result).toEqual(mockSessionToken);
      expect(authService.isAuthenticated()).toBe(true);
      expect(authService.getCurrentSession()).toEqual(mockSessionToken);
    });

    it('should throw error for invalid credentials type', async () => {
      const invalidCredentials = { invalid: 'credentials' } as any;

      await expect(authService.authenticate(invalidCredentials, mockContextIdentifier))
        .rejects.toThrow('Invalid credentials type');
    });

    it('should handle certificate validation failure', async () => {
      const { parseCertificate, validateCertificate } = await import('../src/utils/crypto.js');
      (parseCertificate as Mock).mockReturnValue({ privateKey: 'mock-key', certificate: 'mock-cert' });
      (validateCertificate as Mock).mockReturnValue({ 
        valid: false, 
        errors: ['Certificate expired', 'Invalid signature'] 
      });

      await expect(authService.authenticate(mockCertCredentials, mockContextIdentifier))
        .rejects.toThrow(AuthenticationError);
    });

    it('should handle HTTP errors during authentication', async () => {
      const { parseCertificate, validateCertificate } = await import('../src/utils/crypto.js');
      (parseCertificate as Mock).mockReturnValue({ privateKey: 'mock-key', certificate: 'mock-cert' });
      (validateCertificate as Mock).mockReturnValue({ valid: true, errors: [] });

      mockHttpClient.request.mockRejectedValueOnce(new Error('Network error'));

      await expect(authService.authenticate(mockCertCredentials, mockContextIdentifier))
        .rejects.toThrow('Network error');
    });
  });

  describe('Session Management', () => {
    it('should return undefined session when not authenticated', () => {
      expect(authService.getCurrentSession()).toBeUndefined();
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should track session after successful authentication', async () => {
      const mockSessionToken: SessionToken = {
        token: 'test-session-token',
        context: {
          contextIdentifier: mockContextIdentifier,
          credentialsRoleList: ['USER']
        }
      };

      const { parseCertificate, validateCertificate } = await import('../src/utils/crypto.js');
      (parseCertificate as Mock).mockReturnValue({ privateKey: 'mock-key', certificate: 'mock-cert' });
      (validateCertificate as Mock).mockReturnValue({ valid: true, errors: [] });

      mockHttpClient.request
        .mockResolvedValueOnce({ data: { challenge: 'c', timestamp: '2024-01-15T10:30:00Z' }})
        .mockResolvedValueOnce({ data: { sessionToken: mockSessionToken, referenceNumber: 'ref' }});

      await authService.authenticate(mockCertCredentials, mockContextIdentifier);

      expect(authService.getCurrentSession()).toEqual(mockSessionToken);
      expect(authService.isAuthenticated()).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle HTTP 401 errors', async () => {
      const { parseCertificate, validateCertificate } = await import('../src/utils/crypto.js');
      (parseCertificate as Mock).mockReturnValue({ privateKey: 'mock-key', certificate: 'mock-cert' });
      (validateCertificate as Mock).mockReturnValue({ valid: true, errors: [] });

      const unauthorizedError = new Error('Unauthorized');
      (unauthorizedError as any).status = 401;
      mockHttpClient.request.mockRejectedValueOnce(unauthorizedError);

      await expect(authService.authenticate(mockCertCredentials, mockContextIdentifier))
        .rejects.toThrow('Unauthorized');
    });

    it('should handle different context identifier types', async () => {
      const peselContext: ContextIdentifier = {
        type: 'pesel',
        value: '12345678901'
      };

      const mockSessionToken: SessionToken = {
        token: 'mock-session-token',
        context: {
          contextIdentifier: peselContext,
          credentialsRoleList: ['USER']
        }
      };

      const { parseCertificate, validateCertificate } = await import('../src/utils/crypto.js');
      (parseCertificate as Mock).mockReturnValue({ privateKey: 'mock-key', certificate: 'mock-cert' });
      (validateCertificate as Mock).mockReturnValue({ valid: true, errors: [] });

      mockHttpClient.request
        .mockResolvedValueOnce({ data: { challenge: 'c', timestamp: '2024-01-15T10:30:00Z' }})
        .mockResolvedValueOnce({ data: { sessionToken: mockSessionToken, referenceNumber: 'ref' }});

      const result = await authService.authenticate(mockCertCredentials, peselContext);

      expect(result.context.contextIdentifier).toEqual(peselContext);
    });
  });

  describe('Token Management', () => {
    let mockCertificateCredentials: CertificateCredentials;

    beforeEach(() => {
      mockCertificateCredentials = {
        certificate: 'mock-certificate-data',
        password: 'mock-password'
      };
    });

    describe('generateToken', () => {
      it('should generate a new authorization token successfully', async () => {
        const mockChallengeResponse: AuthorisationChallengeResponse = {
          challenge: 'mock-challenge',
          timestamp: '2024-01-15T10:30:00Z'
        };

        const mockGenerateResponse: GenerateTokenResponse = {
          elementReferenceNumber: 'token-ref-123',
          status: {
            processingCode: 100,
            processingDescription: 'Processing',
            referenceNumber: 'ref-123',
            timestamp: '2024-01-15T10:30:00Z'
          }
        };

        mockHttpClient.request
          .mockResolvedValueOnce({ data: mockChallengeResponse }) // Authorization challenge
          .mockResolvedValueOnce({ data: mockGenerateResponse }); // Token generation

        const result = await authService.generateToken(
          mockCertificateCredentials,
          mockContextIdentifier,
          'Test token description'
        );

        expect(result).toEqual(mockGenerateResponse);
        expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
        expect(mockHttpClient.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: expect.stringContaining('/online/Session/AuthorisationChallenge')
          })
        );
        expect(mockHttpClient.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: expect.stringContaining('/online/Credentials/GenerateToken')
          })
        );
      });

      it('should handle certificate validation failure', async () => {
        const { validateCertificate } = await import('../src/utils/crypto.js');
        (validateCertificate as Mock).mockReturnValue({ 
          valid: false, 
          errors: ['Certificate expired'] 
        });

        await expect(authService.generateToken(
          mockCertificateCredentials,
          mockContextIdentifier
        )).rejects.toThrow('Certificate validation failed: Certificate expired');
      });
    });

    describe('revokeToken', () => {
      it('should revoke an existing token successfully', async () => {
        const tokenNumber = 'token-123';
        const mockSessionToken: SessionToken = {
          token: 'session-token-123',
          context: {
            contextIdentifier: mockContextIdentifier,
            credentialsRoleList: ['USER']
          }
        };

        mockHttpClient.request.mockResolvedValueOnce({});

        await authService.revokeToken(tokenNumber, mockSessionToken);

        expect(mockHttpClient.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: expect.stringContaining('/online/Credentials/RevokeToken'),
            headers: {
              'SessionToken': 'Token session-token-123'
            },
            body: JSON.stringify({ tokenNumber })
          })
        );
      });
    });

    describe('queryTokens', () => {
      it('should query active tokens successfully', async () => {
        const mockSessionToken: SessionToken = {
          token: 'session-token-123',
          context: {
            contextIdentifier: mockContextIdentifier,
            credentialsRoleList: ['USER']
          }
        };

        const mockQueryResponse: QueryTokensResponse = {
          tokenList: [
            {
              tokenNumber: 'token-1',
              description: 'Test token 1',
              createdTimestamp: '2024-01-15T10:30:00Z',
              status: 'ACTIVE'
            }
          ],
          status: {
            processingCode: 200,
            processingDescription: 'Completed',
            referenceNumber: 'ref-123',
            timestamp: '2024-01-15T10:30:00Z'
          }
        };

        mockHttpClient.request.mockResolvedValueOnce({ data: mockQueryResponse });

        const result = await authService.queryTokens(
          mockContextIdentifier,
          mockSessionToken,
          true
        );

        expect(result).toEqual(mockQueryResponse);
        expect(mockHttpClient.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: expect.stringContaining('/online/Credentials/QueryTokens'),
            headers: {
              'SessionToken': 'Token session-token-123'
            }
          })
        );
      });
    });
  });
}); 