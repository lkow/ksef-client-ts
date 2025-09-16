/**
 * Performance tests for KSeF client
 */

import { describe, it, expect } from 'vitest';
import { createKsefClient, createTestClient } from '../src/client.js';
import { validateNIP, validatePESEL } from '../src/utils/validation.js';
import { generateSHA256Hash } from '../src/utils/crypto.js';

describe('Performance Tests', () => {
  describe('Client Initialization', () => {
    it('should initialize client quickly', () => {
      const start = performance.now();
      
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
      
      const end = performance.now();
      const duration = end - start;
      
      expect(client).toBeDefined();
      expect(duration).toBeLessThan(50); // Should initialize in under 50ms
    });

    it('should create multiple clients efficiently', () => {
      const start = performance.now();
      const clients: ReturnType<typeof createTestClient>[] = [];
      
      for (let i = 0; i < 100; i++) {
        const client = createTestClient(
          { authToken: `token-${i}` },
          { type: 'onip', value: '1234567890' }
        );
        clients.push(client);
      }
      
      const end = performance.now();
      const duration = end - start;
      const avgDuration = duration / 100;
      
      expect(clients).toHaveLength(100);
      expect(avgDuration).toBeLessThan(5); // Average under 5ms per client
    });
  });

  describe('Validation Performance', () => {
    it('should validate NIPs quickly', () => {
      const testNIPs = [
        '1234567890',
        '9876543210',
        '5555555555',
        '1111111111',
        '9999999999'
      ];
      
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        for (const nip of testNIPs) {
          validateNIP(nip);
        }
      }
      
      const end = performance.now();
      const duration = end - start;
      const opsPerMs = (1000 * testNIPs.length) / duration;
      
      expect(opsPerMs).toBeGreaterThan(10); // At least 10 validations per ms
    });

    it('should validate PESELs quickly', () => {
      const testPESELs = [
        '80071812345',
        '90123156789',
        '85040212345',
        '75010298765',
        '95123145678'
      ];
      
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        for (const pesel of testPESELs) {
          validatePESEL(pesel);
        }
      }
      
      const end = performance.now();
      const duration = end - start;
      const opsPerMs = (1000 * testPESELs.length) / duration;
      
      expect(opsPerMs).toBeGreaterThan(10); // At least 10 validations per ms
    });
  });

  describe('Crypto Performance', () => {
    it('should compute hashes quickly', () => {
      const testData = 'Sample invoice XML content that could be quite long in real scenarios';
      const buffer = Buffer.from(testData.repeat(100), 'utf-8'); // ~7KB of data
      
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        generateSHA256Hash(buffer);
      }
      
      const end = performance.now();
      const duration = end - start;
      const avgDuration = duration / 100;
      
      expect(avgDuration).toBeLessThan(5); // Average under 5ms per hash
    });

    it('should handle large data efficiently', () => {
      const largeData = 'x'.repeat(1024 * 1024); // 1MB of data
      const buffer = Buffer.from(largeData, 'utf-8');
      
      const start = performance.now();
      const hash = generateSHA256Hash(buffer);
      const end = performance.now();
      
      const duration = end - start;
      
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // SHA-256 hex length
      expect(duration).toBeLessThan(100); // Should process 1MB in under 100ms
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with multiple client creations', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and discard many clients
      for (let i = 0; i < 50; i++) {
        const client = createTestClient(
          { authToken: `token-${i}` },
          { type: 'onip', value: '1234567890' }
        );
        
        // Use the client briefly
        expect(client.isAuthenticated()).toBe(false);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseKB = memoryIncrease / 1024;
      
      // Memory increase should be reasonable (less than 1MB for 50 clients)
      expect(memoryIncreaseKB).toBeLessThan(1024);
    });
  });

  describe('Configuration Performance', () => {
    it('should handle configuration updates efficiently', () => {
      const client = createTestClient(
        { authToken: 'test-token' },
        { type: 'onip', value: '1234567890' }
      );
      
      const start = performance.now();
      
      // Perform many configuration updates
      for (let i = 0; i < 1000; i++) {
        client.updateConfig({
          debug: i % 2 === 0,
          httpOptions: {
            timeout: 30000 + i,
            retries: 3 + (i % 5)
          }
        });
      }
      
      const end = performance.now();
      const duration = end - start;
      const avgDuration = duration / 1000;
      
      expect(avgDuration).toBeLessThan(1); // Average under 1ms per update
    });
  });

  describe('Type System Performance', () => {
    it('should handle complex type operations efficiently', () => {
      const start = performance.now();
      
      // Create clients with complex configurations
      for (let i = 0; i < 50; i++) {
        const client = createKsefClient({
          environment: {
            name: `custom-${i}`,
            baseUrl: `https://custom-${i}.ksef.mf.gov.pl/api/v2`,
            description: `Custom environment ${i}`
          },
          credentials: {
            certificate: `certificate-${i}`,
            password: `password-${i}`,
            privateKey: `private-key-${i}`
          },
          contextIdentifier: {
            type: 'onip',
            value: `123456789${i % 10}`
          },
          httpOptions: {
            timeout: 30000 + i * 1000,
            retries: 3 + (i % 5),
            userAgent: `Custom-Client-${i}/1.0`,
            headers: {
              'X-Custom-Header': `value-${i}`,
              'X-Client-Id': `client-${i}`
            }
          },
          debug: i % 2 === 0
        });
        
        // Verify the client is properly typed
        expect(client).toBeDefined();
        expect(typeof client.login).toBe('function');
      }
      
      const end = performance.now();
      const duration = end - start;
      const avgDuration = duration / 50;
      
      expect(avgDuration).toBeLessThan(10); // Average under 10ms per complex client
    });
  });
}); 