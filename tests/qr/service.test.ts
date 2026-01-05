import { describe, it, expect, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import {
  QRCodeService,
  createQRCodeService
} from '../../src/api2/qr/service.js';
import {
  CertificateType,
  type InvoiceQRCodeData,
  type OfflineCertificate
} from '../../src/api2/qr/types.js';
import { ContextIdentifierType } from '../../src/api2/types/common.js';

describe('QRCodeService', () => {
  let service: QRCodeService;

  // Generate test keys for offline certificate
  const rsaKeyPair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const mockOfflineCertificate: OfflineCertificate = {
    certificate: rsaKeyPair.publicKey,
    privateKey: rsaKeyPair.privateKey,
    serialNumber: '01F20A5D352AE590',
    type: CertificateType.OFFLINE
  };

  const sampleInvoiceData: InvoiceQRCodeData = {
    invoiceXml: '<?xml version="1.0"?><Faktura><P_1>2024-01-15</P_1></Faktura>',
    invoiceDate: '2024-01-15',
    sellerNip: '1234567890'
  };

  beforeEach(() => {
    service = new QRCodeService('test');
  });

  describe('constructor', () => {
    it('creates service with default prod environment', () => {
      const prodService = new QRCodeService();
      expect(prodService.getEnvironment()).toBe('prod');
      expect(prodService.getBaseUrl()).toBe('https://qr.ksef.mf.gov.pl');
    });

    it('creates service with test environment', () => {
      expect(service.getEnvironment()).toBe('test');
      expect(service.getBaseUrl()).toBe('https://qr-test.ksef.mf.gov.pl');
    });

    it('creates service with demo environment', () => {
      const demoService = new QRCodeService('demo');
      expect(demoService.getEnvironment()).toBe('demo');
      expect(demoService.getBaseUrl()).toBe('https://qr-demo.ksef.mf.gov.pl');
    });
  });

  describe('setEnvironment', () => {
    it('updates environment and base URL', () => {
      service.setEnvironment('prod');
      expect(service.getEnvironment()).toBe('prod');
      expect(service.getBaseUrl()).toBe('https://qr.ksef.mf.gov.pl');
    });
  });

  describe('generateKod1', () => {
    it('generates KOD I with OFFLINE label for offline invoice', async () => {
      const data: InvoiceQRCodeData = {
        ...sampleInvoiceData,
        isOffline: true
      };

      const kod1 = await service.generateKod1(data);

      expect(kod1.label).toBe('OFFLINE');
      expect(kod1.url).toContain('https://qr-test.ksef.mf.gov.pl/invoice/');
      expect(kod1.url).toContain('1234567890');
      expect(kod1.url).toContain('15-01-2024');
      expect(kod1.qrCode.format).toBe('dataurl');
      expect(kod1.qrCode.data).toContain('data:image/png;base64,');
    });

    it('generates KOD I with KSeF reference number for online invoice', async () => {
      const data: InvoiceQRCodeData = {
        ...sampleInvoiceData,
        ksefReferenceNumber: 'KSEF-123456789'
      };

      const kod1 = await service.generateKod1(data);

      expect(kod1.label).toBe('KSEF-123456789');
    });

    it('generates KOD I with different output formats', async () => {
      const data: InvoiceQRCodeData = {
        ...sampleInvoiceData,
        ksefReferenceNumber: 'KSEF-123456789'
      };

      const svgKod1 = await service.generateKod1(data, { format: 'svg' });
      expect(svgKod1.qrCode.format).toBe('svg');
      expect(typeof svgKod1.qrCode.data).toBe('string');
      expect(svgKod1.qrCode.data).toContain('<svg');

      const pngKod1 = await service.generateKod1(data, { format: 'png' });
      expect(pngKod1.qrCode.format).toBe('png');
      expect(Buffer.isBuffer(pngKod1.qrCode.data)).toBe(true);
    });

    it('includes timestamp in result', async () => {
      const data: InvoiceQRCodeData = {
        ...sampleInvoiceData,
        ksefReferenceNumber: 'KSEF-123456789'
      };
      const kod1 = await service.generateKod1(data);
      expect(kod1.qrCode.timestamp).toBeTruthy();
      expect(new Date(kod1.qrCode.timestamp).getTime()).not.toBeNaN();
    });

    it('throws error when online invoice is missing ksefReferenceNumber', async () => {
      const data: InvoiceQRCodeData = {
        ...sampleInvoiceData,
        isOffline: false
      };

      await expect(service.generateKod1(data)).rejects.toThrow(
        'ksefReferenceNumber is required for online invoices'
      );
    });

    it('throws error when isOffline is undefined and ksefReferenceNumber is missing', async () => {
      // sampleInvoiceData has no isOffline and no ksefReferenceNumber
      await expect(service.generateKod1(sampleInvoiceData)).rejects.toThrow(
        'ksefReferenceNumber is required for online invoices'
      );
    });
  });

  describe('generateKod2', () => {
    it('generates KOD II for offline invoice with certificate', async () => {
      const data: InvoiceQRCodeData = {
        ...sampleInvoiceData,
        isOffline: true
      };

      const kod2 = await service.generateKod2(data, mockOfflineCertificate);

      expect(kod2.label).toBe('CERTYFIKAT');
      expect(kod2.certificateSerialNumber).toBe('01F20A5D352AE590');
      expect(kod2.url).toContain('https://qr-test.ksef.mf.gov.pl/certificate/');
      expect(kod2.url).toContain('Nip');
      expect(kod2.url).toContain('1234567890');
      expect(kod2.url).toContain('01F20A5D352AE590');
      // URL should have signature at the end
      expect(kod2.url.split('/').length).toBeGreaterThan(6);
    });

    it('uses custom context identifier if provided', async () => {
      const data: InvoiceQRCodeData = {
        ...sampleInvoiceData,
        isOffline: true,
        contextIdentifier: { type: ContextIdentifierType.INTERNAL_ID, value: 'CUSTOM-123' }
      };

      const kod2 = await service.generateKod2(data, mockOfflineCertificate);

      expect(kod2.url).toContain('/InternalId/CUSTOM-123/');
    });

    it('throws for non-offline certificate type', async () => {
      const invalidCertificate = {
        ...mockOfflineCertificate,
        type: CertificateType.AUTHENTICATION
      } as unknown as OfflineCertificate;

      await expect(
        service.generateKod2(sampleInvoiceData, invalidCertificate)
      ).rejects.toThrow('Offline certificate with type "Offline" is required');
    });
  });

  describe('generateInvoiceQRCodes', () => {
    it('generates only KOD I for online invoice', async () => {
      const data: InvoiceQRCodeData = {
        ...sampleInvoiceData,
        ksefReferenceNumber: 'KSEF-123456789'
      };

      const result = await service.generateInvoiceQRCodes(data);

      expect(result.isOffline).toBe(false);
      expect(result.kod1).toBeDefined();
      expect(result.kod2).toBeUndefined();
    });

    it('generates KOD I and KOD II for offline invoice', async () => {
      const data: InvoiceQRCodeData = {
        ...sampleInvoiceData,
        isOffline: true
      };

      const result = await service.generateInvoiceQRCodes(data, mockOfflineCertificate);

      expect(result.isOffline).toBe(true);
      expect(result.kod1).toBeDefined();
      expect(result.kod2).toBeDefined();
    });

    it('throws when offline invoice lacks certificate', async () => {
      const data: InvoiceQRCodeData = {
        ...sampleInvoiceData,
        isOffline: true
      };

      await expect(
        service.generateInvoiceQRCodes(data)
      ).rejects.toThrow('Offline certificate required');
    });
  });

  describe('createQRCodeService factory', () => {
    it('creates service with default prod environment', () => {
      const service = createQRCodeService();
      expect(service.getEnvironment()).toBe('prod');
    });

    it('creates service with specified environment', () => {
      const service = createQRCodeService('demo');
      expect(service.getEnvironment()).toBe('demo');
    });
  });
});

