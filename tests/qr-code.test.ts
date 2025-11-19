/**
 * QR Code Service Tests
 * Tests KOD I and KOD II generation per kody-qr.md specification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QRCodeService } from '../src/services/qr-code.js';
import {
  formatDateForQR,
  toBase64URL,
  fromBase64URL,
  CertificateType
} from '../src/types/qr-code.js';
import type {
  InvoiceQRCodeData,
  OfflineCertificate
} from '../src/types/qr-code.js';
import { generateSHA256Hash } from '../src/utils/crypto.js';
import { createHash } from 'node:crypto';
import * as signingModule from '../src/utils/signing.js';

describe('QRCodeService', () => {
  let qrService: QRCodeService;
  
  const sampleInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2025/02/14/02141/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA(3)" wersjaSchemy="1-0">FA</KodFormularza>
    <DataWytworzeniaFa>2025-01-15T10:30:00Z</DataWytworzeniaFa>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>1234567890</NIP>
      <Nazwa>Example Seller</Nazwa>
    </DaneIdentyfikacyjne>
  </Podmiot1>
  <Fa>
    <P_1>2025-01-15</P_1>
    <P_2>FV/2025/001</P_2>
    <P_15>1230.00</P_15>
  </Fa>
</Faktura>`;

  beforeEach(() => {
    qrService = new QRCodeService('test', true);
  });

  describe('KOD I (Invoice Verification)', () => {
    it('should generate KOD I for online invoice', async () => {
      const invoiceData: InvoiceQRCodeData = {
        invoiceXml: sampleInvoiceXml,
        invoiceDate: '2025-01-15',
        sellerNip: '1234567890',
        ksefReferenceNumber: '1234567890-20250115-ABCD1234-01',
        isOffline: false
      };

      const kod1 = await qrService.generateKod1(invoiceData);

      // Check structure
      expect(kod1).toHaveProperty('qrCode');
      expect(kod1).toHaveProperty('label');
      expect(kod1).toHaveProperty('url');

      // Check label (should be KSeF reference number)
      expect(kod1.label).toBe('1234567890-20250115-ABCD1234-01');

      // Check URL format
      expect(kod1.url).toContain('https://ksef-test.mf.gov.pl/client-app/invoice/');
      expect(kod1.url).toContain('/1234567890/'); // Seller NIP
      expect(kod1.url).toContain('/15-01-2025/'); // Date formatted as DD-MM-YYYY

      // Verify QR code data exists
      expect(kod1.qrCode.data).toBeDefined();
      expect(kod1.qrCode.format).toBe('dataurl');
    });

    it('should generate KOD I for offline invoice with OFFLINE label', async () => {
      const invoiceData: InvoiceQRCodeData = {
        invoiceXml: sampleInvoiceXml,
        invoiceDate: '2025-01-15',
        sellerNip: '1234567890',
        isOffline: true
      };

      const kod1 = await qrService.generateKod1(invoiceData);

      // Check label (should be "OFFLINE")
      expect(kod1.label).toBe('OFFLINE');

      // Check URL format
      expect(kod1.url).toContain('https://ksef-test.mf.gov.pl/client-app/invoice/');
      expect(kod1.url).toContain('/1234567890/');
      expect(kod1.url).toContain('/15-01-2025/');
    });

    it('should use Base64URL encoding for hash', async () => {
      const invoiceData: InvoiceQRCodeData = {
        invoiceXml: sampleInvoiceXml,
        invoiceDate: '2025-01-15',
        sellerNip: '1234567890',
        isOffline: true
      };

      const kod1 = await qrService.generateKod1(invoiceData);

      // Extract hash from URL
      const urlParts = kod1.url.split('/');
      const hash = urlParts[urlParts.length - 1];

      // Base64URL should not contain +, /, or =
      expect(hash).not.toContain('+');
      expect(hash).not.toContain('/');
      expect(hash).not.toContain('=');

      // Should contain - or _ (Base64URL characters)
      // Note: hash might not always contain these, but should be valid Base64URL
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should format date as DD-MM-YYYY', async () => {
      const invoiceData: InvoiceQRCodeData = {
        invoiceXml: sampleInvoiceXml,
        invoiceDate: '2025-03-25', // ISO format
        sellerNip: '1234567890',
        isOffline: true
      };

      const kod1 = await qrService.generateKod1(invoiceData);

      // Should contain 25-03-2025 (DD-MM-YYYY)
      expect(kod1.url).toContain('/25-03-2025/');
    });

    it('should calculate correct SHA-256 hash', async () => {
      const invoiceData: InvoiceQRCodeData = {
        invoiceXml: sampleInvoiceXml,
        invoiceDate: '2025-01-15',
        sellerNip: '1234567890',
        isOffline: true
      };

      const kod1 = await qrService.generateKod1(invoiceData);

      // Calculate expected hash
      const expectedHash = createHash('sha256')
        .update(sampleInvoiceXml, 'utf8')
        .digest('base64');
      const expectedHashBase64URL = toBase64URL(expectedHash);

      // Extract hash from URL
      const urlParts = kod1.url.split('/');
      const actualHash = urlParts[urlParts.length - 1];

      expect(actualHash).toBe(expectedHashBase64URL);
    });
  });

  describe('KOD II (Certificate Verification)', () => {
    // Mock certificate for testing
    const mockOfflineCertificate: OfflineCertificate = {
      certificate: 'mock-certificate-data',
      privateKey: 'mock-private-key',
      serialNumber: '01F20A5D352AE590',
      type: CertificateType.OFFLINE
    };

    beforeEach(() => {
      // Mock the signAuto function to return a deterministic signature
      vi.spyOn(signingModule, 'signAuto').mockReturnValue(
        'mocked-signature-base64url-encoded'
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should generate KOD II for offline invoice', async () => {
      const invoiceData: InvoiceQRCodeData = {
        invoiceXml: sampleInvoiceXml,
        invoiceDate: '2025-01-15',
        sellerNip: '1234567890',
        isOffline: true
      };

      const kod2 = await qrService.generateKod2(
        invoiceData,
        mockOfflineCertificate
      );

      // Check structure
      expect(kod2).toHaveProperty('qrCode');
      expect(kod2).toHaveProperty('label');
      expect(kod2).toHaveProperty('url');
      expect(kod2).toHaveProperty('certificateSerialNumber');

      // Check label
      expect(kod2.label).toBe('CERTYFIKAT');

      // Check certificate serial
      expect(kod2.certificateSerialNumber).toBe('01F20A5D352AE590');

      // Check URL format
      expect(kod2.url).toContain('https://ksef-test.mf.gov.pl/client-app/certificate/');
      expect(kod2.url).toContain('/Nip/'); // Context type
      expect(kod2.url).toContain('/1234567890/'); // Context value (seller NIP)
      expect(kod2.url).toContain('/01F20A5D352AE590/'); // Certificate serial

      // URL should end with our mocked signature
      const urlParts = kod2.url.split('/');
      const signature = urlParts[urlParts.length - 1];
      expect(signature).toBe('mocked-signature-base64url-encoded');
    });

    it('should generate both KOD I and KOD II for offline invoice', async () => {
      const invoiceData: InvoiceQRCodeData = {
        invoiceXml: sampleInvoiceXml,
        invoiceDate: '2025-01-15',
        sellerNip: '1234567890',
        isOffline: true
      };

      const qrCodes = await qrService.generateInvoiceQRCodes(
        invoiceData,
        mockOfflineCertificate
      );

      // Should have both KOD I and KOD II
      expect(qrCodes.kod1).toBeDefined();
      expect(qrCodes.kod2).toBeDefined();
      expect(qrCodes.isOffline).toBe(true);

      // KOD I should have OFFLINE label
      expect(qrCodes.kod1.label).toBe('OFFLINE');

      // KOD II should have CERTYFIKAT label
      expect(qrCodes.kod2?.label).toBe('CERTYFIKAT');
    });

    it('should not generate KOD II for online invoice', async () => {
      const invoiceData: InvoiceQRCodeData = {
        invoiceXml: sampleInvoiceXml,
        invoiceDate: '2025-01-15',
        sellerNip: '1234567890',
        ksefReferenceNumber: '1234567890-20250115-ABCD1234-01',
        isOffline: false
      };

      const qrCodes = await qrService.generateInvoiceQRCodes(
        invoiceData,
        mockOfflineCertificate // Even if certificate is provided
      );

      // Should only have KOD I
      expect(qrCodes.kod1).toBeDefined();
      expect(qrCodes.kod2).toBeUndefined();
      expect(qrCodes.isOffline).toBe(false);

      // KOD I should have KSeF reference number
      expect(qrCodes.kod1.label).toBe('1234567890-20250115-ABCD1234-01');
    });

    it('should throw error if certificate is missing for offline invoice', async () => {
      const invoiceData: InvoiceQRCodeData = {
        invoiceXml: sampleInvoiceXml,
        invoiceDate: '2025-01-15',
        sellerNip: '1234567890',
        isOffline: true
      };

      // Should throw ValidationError when trying to generate KOD II without certificate
      await expect(
        qrService.generateInvoiceQRCodes(invoiceData) // No certificate
      ).rejects.toThrow('Offline certificate required');
    });

    it('should use same hash for both KOD I and KOD II', async () => {
      const invoiceData: InvoiceQRCodeData = {
        invoiceXml: sampleInvoiceXml,
        invoiceDate: '2025-01-15',
        sellerNip: '1234567890',
        isOffline: true
      };

      const qrCodes = await qrService.generateInvoiceQRCodes(
        invoiceData,
        mockOfflineCertificate
      );

      // Extract hashes from URLs
      const kod1Parts = qrCodes.kod1.url.split('/');
      const kod1Hash = kod1Parts[kod1Parts.length - 1];

      const kod2Parts = qrCodes.kod2!.url.split('/');
      // KOD II has signature at the end, hash is second-to-last
      const kod2Hash = kod2Parts[kod2Parts.length - 2];

      // Hashes should be identical
      expect(kod1Hash).toBe(kod2Hash);
    });
  });

  describe('Utility Functions', () => {
    describe('formatDateForQR', () => {
      it('should format ISO date to DD-MM-YYYY', () => {
        expect(formatDateForQR('2025-01-15')).toBe('15-01-2025');
        expect(formatDateForQR('2025-12-31')).toBe('31-12-2025');
        expect(formatDateForQR('2025-03-05')).toBe('05-03-2025');
      });

      it('should handle ISO 8601 full format', () => {
        expect(formatDateForQR('2025-01-15T10:30:00Z')).toBe('15-01-2025');
        expect(formatDateForQR('2025-12-31T23:59:59+01:00')).toBe('31-12-2025');
      });

      it('should throw error for invalid date', () => {
        expect(() => formatDateForQR('invalid-date')).toThrow('Invalid date format');
        expect(() => formatDateForQR('2025-13-01')).toThrow('Invalid date format');
      });
    });

    describe('Base64URL encoding', () => {
      it('should convert Base64 to Base64URL', () => {
        const base64 = 'Hello+World/Test==';
        const base64url = toBase64URL(base64);

        expect(base64url).toBe('Hello-World_Test');
        expect(base64url).not.toContain('+');
        expect(base64url).not.toContain('/');
        expect(base64url).not.toContain('=');
      });

      it('should convert Base64URL back to Base64', () => {
        // Use a Base64URL string that actually needs padding
        // 'SGVsbG8' is 7 chars, needs 1 '=' to make it 8 (multiple of 4)
        const base64url = 'SGVsbG8'; // "Hello" in Base64
        const base64 = fromBase64URL(base64url);

        expect(base64).toBe('SGVsbG8=');
      });

      it('should be reversible', () => {
        const original = 'Test+Data/With=Padding==';
        const encoded = toBase64URL(original);
        const decoded = fromBase64URL(encoded);

        expect(decoded).toBe(original);
      });
    });
  });

  describe('QR Code Output Formats', () => {
    const invoiceData: InvoiceQRCodeData = {
      invoiceXml: sampleInvoiceXml,
      invoiceDate: '2025-01-15',
      sellerNip: '1234567890',
      isOffline: false,
      ksefReferenceNumber: '1234567890-20250115-ABCD1234-01'
    };

    it('should generate data URL format (default)', async () => {
      const kod1 = await qrService.generateKod1(invoiceData, {
        format: 'dataurl'
      });

      expect(kod1.qrCode.format).toBe('dataurl');
      expect(kod1.qrCode.data).toMatch(/^data:image\/png;base64,/);
    });

    it('should generate PNG buffer format', async () => {
      const kod1 = await qrService.generateKod1(invoiceData, {
        format: 'png'
      });

      expect(kod1.qrCode.format).toBe('png');
      expect(Buffer.isBuffer(kod1.qrCode.data)).toBe(true);
    });

    it('should generate SVG format', async () => {
      const kod1 = await qrService.generateKod1(invoiceData, {
        format: 'svg'
      });

      expect(kod1.qrCode.format).toBe('svg');
      expect(typeof kod1.qrCode.data).toBe('string');
      expect(kod1.qrCode.data).toContain('<svg');
    });

    it('should generate UTF-8 terminal format', async () => {
      const kod1 = await qrService.generateKod1(invoiceData, {
        format: 'utf8'
      });

      expect(kod1.qrCode.format).toBe('utf8');
      expect(typeof kod1.qrCode.data).toBe('string');
    });
  });

  describe('Environment Switching', () => {
    it('should use test environment URL', () => {
      const testService = new QRCodeService('test');
      expect(testService.getEnvironment()).toBe('test');
    });

    it('should use prod environment URL', () => {
      const prodService = new QRCodeService('prod');
      expect(prodService.getEnvironment()).toBe('prod');
    });

    it('should allow environment switching', () => {
      const service = new QRCodeService('test');
      expect(service.getEnvironment()).toBe('test');

      service.setEnvironment('prod');
      expect(service.getEnvironment()).toBe('prod');
    });
  });
});

