/**
 * Integration tests for KSeF client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createKsefClient, createTestClient } from '../src/client.js';
import type { KsefClientConfig, CertificateCredentials } from '../src/types/index.js';
import { KsefApiError, AuthenticationError } from '../src/types/common.js';

describe('KSeF Client', () => {
  let mockConfig: KsefClientConfig;

  beforeEach(() => {
    mockConfig = {
      environment: 'test',
      credentials: {
        certificate: 'mock-certificate',
        password: 'mock-password'
      } as CertificateCredentials,
      contextIdentifier: {
        type: 'onip',
        value: '1234567890'
      },
      debug: false
    };
  });

  describe('Client Creation', () => {
    it('should create client with valid configuration', () => {
      const client = createKsefClient(mockConfig);
      expect(client).toBeDefined();
      expect(client.isAuthenticated()).toBe(false);
    });

    it('should create test client with simplified config', () => {
      const client = createTestClient(
        mockConfig.credentials,
        mockConfig.contextIdentifier,
        true
      );
      expect(client).toBeDefined();
    });

    it('should throw error for invalid environment', () => {
      const invalidConfig = {
        ...mockConfig,
        environment: 'invalid' as any
      };
      
      expect(() => createKsefClient(invalidConfig)).toThrow();
    });
  });

  describe('Configuration Management', () => {
    it('should get configuration without sensitive data', () => {
      const client = createKsefClient(mockConfig);
      const config = client.getConfig();
      
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('contextIdentifier');
      expect(config).not.toHaveProperty('credentials');
    });

    it('should update configuration', () => {
      const client = createKsefClient(mockConfig);
      
      client.updateConfig({
        debug: true,
        httpOptions: { timeout: 60000 }
      });
      
      const config = client.getConfig();
      expect(config.debug).toBe(true);
      expect(config.httpOptions?.timeout).toBe(60000);
    });
  });

  describe('Authentication Status', () => {
    it('should report not authenticated initially', () => {
      const client = createKsefClient(mockConfig);
      expect(client.isAuthenticated()).toBe(false);
      expect(client.getCurrentSession()).toBeUndefined();
    });
  });

  describe('Environment Configuration', () => {
    it('should handle string environment names', () => {
      const config = { ...mockConfig, environment: 'test' as const };
      const client = createKsefClient(config);
      expect(client).toBeDefined();
    });

    it('should handle environment objects', () => {
      const config = {
        ...mockConfig,
        environment: {
          name: 'custom',
          baseUrl: 'https://custom.ksef.mf.gov.pl/api/v2',
          description: 'Custom environment'
        }
      };
      const client = createKsefClient(config);
      expect(client).toBeDefined();
    });
  });

  describe('Debug Mode', () => {
    it('should initialize with debug mode enabled', () => {
      const config = { ...mockConfig, debug: true };
      const client = createKsefClient(config);
      expect(client.getConfig().debug).toBe(true);
    });

    it('should default to debug disabled', () => {
      const client = createKsefClient(mockConfig);
      expect(client.getConfig().debug).toBe(false);
    });
  });

  describe('HTTP Options', () => {
    it('should accept custom HTTP options', () => {
      const config = {
        ...mockConfig,
        httpOptions: {
          timeout: 45000,
          retries: 5,
          userAgent: 'Custom-KSeF-Client/1.0'
        }
      };
      
      const client = createKsefClient(config);
      const retrievedConfig = client.getConfig();
      
      expect(retrievedConfig.httpOptions?.timeout).toBe(45000);
      expect(retrievedConfig.httpOptions?.retries).toBe(5);
      expect(retrievedConfig.httpOptions?.userAgent).toBe('Custom-KSeF-Client/1.0');
    });
  });

  describe('Context Identifier Validation', () => {
    it('should accept valid NIP context', () => {
      const config = {
        ...mockConfig,
        contextIdentifier: { type: 'onip' as const, value: '1234567890' }
      };
      
      const client = createKsefClient(config);
      expect(client).toBeDefined();
    });

    it('should accept valid PESEL context', () => {
      const config = {
        ...mockConfig,
        contextIdentifier: { type: 'pesel' as const, value: '12345678901' }
      };
      
      const client = createKsefClient(config);
      expect(client).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', () => {
      expect(() => {
        createKsefClient({} as any);
      }).toThrow();
    });

    it('should validate required fields during login', async () => {
      const incompleteConfig = {
        environment: 'test'
        // Missing credentials and contextIdentifier
      } as any;
      
      const client = createKsefClient(incompleteConfig);
      
      // Should fail when trying to use missing fields
      await expect(client.login()).rejects.toThrow();
    });
  });
});

describe('KSeF Client Integration', () => {
  describe('Service Initialization', () => {
    it('should initialize all required services', () => {
      const client = createKsefClient({
        environment: 'test',
        credentials: {
          certificate: 'mock-cert',
          password: 'mock-pass'
        },
        contextIdentifier: {
          type: 'onip',
          value: '1234567890'
        }
      });

      // Verify client is properly constructed
      expect(client).toBeDefined();
      expect(typeof client.login).toBe('function');
      expect(typeof client.submitInvoice).toBe('function');
      expect(typeof client.getInvoice).toBe('function');
      expect(typeof client.queryInvoices).toBe('function');
    });
  });

  describe('Method Availability', () => {
    let client: ReturnType<typeof createKsefClient>;

    beforeEach(() => {
      client = createTestClient(
        { authToken: 'mock-token' },
        { type: 'onip', value: '1234567890' }
      );
    });

    it('should have authentication methods', () => {
      expect(typeof client.login).toBe('function');
      expect(typeof client.isAuthenticated).toBe('function');
      expect(typeof client.getCurrentSession).toBe('function');
    });

    it('should have invoice methods', () => {
      expect(typeof client.submitInvoice).toBe('function');
      expect(typeof client.getInvoice).toBe('function');
      expect(typeof client.queryInvoices).toBe('function');
    });

    it('should have configuration methods', () => {
      expect(typeof client.updateConfig).toBe('function');
      expect(typeof client.getConfig).toBe('function');
    });
  });
}); 