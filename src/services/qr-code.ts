/**
 * QR code generation service for KSeF invoices
 * Based on: https://github.com/CIRFMF/ksef-docs/blob/main/kody-qr.md
 */

import QRCode from 'qrcode';
import { createHash } from 'node:crypto';
import type {
  QRCodeOptions,
  QRCodeResult,
  InvoiceQRCodeData,
  InvoiceQRCodes,
  Kod1QRCode,
  Kod2QRCode,
  OfflineCertificate,
  QRCodeFormat
} from '@/types/qr-code.js';
import { formatDateForQR, toBase64URL } from '@/types/qr-code.js';
import { signAuto, extractPathForSigning } from '@/utils/signing.js';
import { Logger } from '@/utils/logger.js';
import { ValidationError } from '@/types/common.js';

export class QRCodeService {
  private logger: Logger;
  private environment: 'test' | 'prod';
  private baseUrl: string;

  constructor(environment: 'test' | 'prod' = 'prod', debug = false) {
    this.environment = environment;
    this.baseUrl = environment === 'prod'
      ? 'https://ksef.mf.gov.pl'
      : 'https://ksef-test.mf.gov.pl';
    
    this.logger = new Logger({
      debug,
      prefix: '[QRCode]'
    });
  }

  /**
   * Generate complete QR code set for an invoice
   * 
   * For online invoices: Generates KOD I only
   * For offline invoices: Generates KOD I + KOD II (requires certificate)
   */
  async generateInvoiceQRCodes(
    data: InvoiceQRCodeData,
    offlineCertificate?: OfflineCertificate,
    options: QRCodeOptions = {}
  ): Promise<InvoiceQRCodes> {
    this.logger.debug('Generating QR codes', {
      isOffline: data.isOffline,
      hasCertificate: !!offlineCertificate
    });

    // Always generate KOD I
    const kod1 = await this.generateKod1(data, options);

    // Generate KOD II only for offline invoices
    let kod2: Kod2QRCode | undefined;
    if (data.isOffline) {
      if (!offlineCertificate) {
        throw new ValidationError(
          'Offline certificate required for generating KOD II QR code for offline invoices'
        );
      }
      kod2 = await this.generateKod2(data, offlineCertificate, options);
    }

    const result: InvoiceQRCodes = {
      kod1,
      isOffline: data.isOffline || false
    };

    if (kod2) {
      result.kod2 = kod2;
    }

    return result;
  }

  /**
   * Generate KOD I (Invoice Verification) QR code
   * 
   * URL format: https://ksef-test.mf.gov.pl/client-app/invoice/{sellerNip}/{date-DD-MM-YYYY}/{sha256HashBase64URL}
   * Label: KSeF reference number OR "OFFLINE"
   * 
   * Used for ALL invoices (online and offline)
   */
  async generateKod1(
    data: InvoiceQRCodeData,
    options: QRCodeOptions = {}
  ): Promise<Kod1QRCode> {
    this.logger.debug('Generating KOD I', { sellerNip: data.sellerNip });

    // Calculate SHA-256 hash of invoice XML
    const hash = createHash('sha256')
      .update(data.invoiceXml, 'utf8')
      .digest('base64');
    const hashBase64URL = toBase64URL(hash);

    // Format date as DD-MM-YYYY
    const dateFormatted = formatDateForQR(data.invoiceDate);

    // Build URL
    const url = `${this.baseUrl}/client-app/invoice/${data.sellerNip}/${dateFormatted}/${hashBase64URL}`;

    // Determine label
    const label = data.ksefReferenceNumber || 'OFFLINE';

    // Generate QR code
    const qrCode = await this.generateQRCode(url, options);

    this.logger.debug('KOD I generated', { url, label });

    return {
      qrCode,
      label,
      url
    };
  }

  /**
   * Generate KOD II (Certificate Verification) QR code
   * 
   * URL format: https://ksef-test.mf.gov.pl/client-app/certificate/{contextType}/{contextValue}/{sellerNip}/{certSerial}/{sha256HashBase64URL}/{signatureBase64URL}
   * Label: "CERTYFIKAT"
   * 
   * ONLY for offline invoices
   * Requires Offline certificate with private key for cryptographic signature
   */
  async generateKod2(
    data: InvoiceQRCodeData,
    offlineCertificate: OfflineCertificate,
    options: QRCodeOptions = {}
  ): Promise<Kod2QRCode> {
    this.logger.debug('Generating KOD II', {
      sellerNip: data.sellerNip,
      certSerial: offlineCertificate.serialNumber
    });

    // Calculate SHA-256 hash of invoice XML
    const hash = createHash('sha256')
      .update(data.invoiceXml, 'utf8')
      .digest('base64');
    const hashBase64URL = toBase64URL(hash);

    // Build URL without signature
    const contextType = 'Nip'; // Assuming NIP, could be InternalId, NipVatUe, PeppolId
    const contextValue = data.sellerNip;
    const certSerial = offlineCertificate.serialNumber;

    const urlWithoutSignature = `${this.baseUrl}/client-app/certificate/${contextType}/${contextValue}/${data.sellerNip}/${certSerial}/${hashBase64URL}`;

    // Extract path for signing (without https:// and trailing /)
    const pathToSign = extractPathForSigning(urlWithoutSignature);

    this.logger.debug('Signing path', { pathToSign });

    // Sign the path with private key
    const signatureBase64URL = signAuto(
      pathToSign,
      offlineCertificate.privateKey,
      offlineCertificate.password
    );

    // Build final URL with signature
    const url = `${urlWithoutSignature}/${signatureBase64URL}`;

    // Generate QR code
    const qrCode = await this.generateQRCode(url, options);

    this.logger.debug('KOD II generated', { url: urlWithoutSignature + '/[signature]' });

    return {
      qrCode,
      label: 'CERTYFIKAT',
      url,
      certificateSerialNumber: certSerial
    };
  }

  /**
   * Generate QR code from URL
   */
  private async generateQRCode(
    url: string,
    options: QRCodeOptions = {}
  ): Promise<QRCodeResult> {
    const format = options.format || 'dataurl';
    const opts = this.buildQRCodeOptions(options);

    this.logger.debug(`Generating QR code in ${format} format`);

    try {
      let data: string | Buffer;

      switch (format) {
        case 'png':
          data = (await QRCode.toBuffer(url, opts) as unknown) as Buffer;
          break;
        case 'svg':
          data = (await QRCode.toString(url, { ...opts, type: 'svg' }) as unknown) as string;
          break;
        case 'dataurl':
          data = (await QRCode.toDataURL(url, opts) as unknown) as string;
          break;
        case 'utf8':
          data = (await QRCode.toString(url, { ...opts, type: 'terminal' }) as unknown) as string;
          break;
        default:
          throw new ValidationError(`Unsupported QR code format: ${format}`);
      }

      return {
        data,
        format,
        inputData: url,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new ValidationError(
        `Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private buildQRCodeOptions(options: QRCodeOptions): any {
    return {
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      width: options.width || 256,
      margin: options.margin || 4,
      color: {
        dark: options.color?.dark || '#000000',
        light: options.color?.light || '#ffffff'
      }
    };
  }

  /**
   * Set environment
   */
  setEnvironment(environment: 'test' | 'prod'): void {
    this.environment = environment;
    this.baseUrl = environment === 'prod'
      ? 'https://ksef.mf.gov.pl'
      : 'https://ksef-test.mf.gov.pl';
    this.logger.debug(`Environment set to: ${environment}`);
  }

  /**
   * Get current environment
   */
  getEnvironment(): 'test' | 'prod' {
    return this.environment;
  }
}

/**
 * Create QR code service instance
 */
export function createQRCodeService(environment: 'test' | 'prod' = 'prod', debug = false): QRCodeService {
  return new QRCodeService(environment, debug);
}

/**
 * Singleton instance for convenience
 */
export const qrCodeService = createQRCodeService();
