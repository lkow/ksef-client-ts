/**
 * QR code generation service for KSeF invoices (API v2)
 * Based on: https://github.com/CIRFMF/ksef-docs/blob/main/kody-qr.md
 */

import QRCode from 'qrcode';
import { createHash } from 'node:crypto';
import type { ApiV2Environment } from '../types/common.js';
import {
  type QRCodeOptions,
  type QRCodeResult,
  type InvoiceQRCodeData,
  type InvoiceQRCodes,
  type Kod1QRCode,
  type Kod2QRCode,
  type OfflineCertificate,
  type QRCodeFormat,
  CertificateType,
  formatDateForQR,
  toBase64URL,
  QR_BASE_URLS
} from './types.js';
import { signAuto, extractPathForSigning } from './signing.js';

export class QRCodeService {
  private environment: ApiV2Environment;
  private baseUrl: string;

  constructor(environment: ApiV2Environment = 'prod') {
    this.environment = environment;
    this.baseUrl = QR_BASE_URLS[environment];
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
    const kod1 = await this.generateKod1(data, options);

    let kod2: Kod2QRCode | undefined;
    if (data.isOffline) {
      if (!offlineCertificate) {
        throw new Error(
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
   * URL format: https://qr-{env}.ksef.mf.gov.pl/invoice/{sellerNip}/{date-DD-MM-YYYY}/{sha256HashBase64URL}
   * Label: KSeF reference number (online) OR "OFFLINE" (offline invoices)
   *
   * Used for ALL invoices (online and offline)
   * 
   * @throws Error if online invoice is missing ksefReferenceNumber
   */
  async generateKod1(
    data: InvoiceQRCodeData,
    options: QRCodeOptions = {}
  ): Promise<Kod1QRCode> {
    const isOffline = data.isOffline ?? false;

    // For online invoices, ksefReferenceNumber is required
    if (!isOffline && !data.ksefReferenceNumber) {
      throw new Error('ksefReferenceNumber is required for online invoices');
    }

    const label = isOffline ? 'OFFLINE' : data.ksefReferenceNumber!;

    const hash = createHash('sha256')
      .update(data.invoiceXml, 'utf8')
      .digest('base64');
    const hashBase64URL = toBase64URL(hash);

    const dateFormatted = formatDateForQR(data.invoiceDate);

    const url = `${this.baseUrl}/invoice/${data.sellerNip}/${dateFormatted}/${hashBase64URL}`;

    const qrCode = await this.generateQRCode(url, options);

    return {
      qrCode,
      label,
      url
    };
  }

  /**
   * Generate KOD II (Certificate Verification) QR code
   *
   * URL format: https://qr-{env}.ksef.mf.gov.pl/certificate/{contextType}/{contextValue}/{sellerNip}/{certSerial}/{sha256HashBase64URL}/{signatureBase64URL}
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
    if (offlineCertificate.type !== CertificateType.OFFLINE) {
      throw new Error('Offline certificate with type "Offline" is required for KOD II generation');
    }

    const hash = createHash('sha256')
      .update(data.invoiceXml, 'utf8')
      .digest('base64');
    const hashBase64URL = toBase64URL(hash);

    const contextIdentifier = data.contextIdentifier ?? { type: 'Nip' as const, value: data.sellerNip };
    const contextType = contextIdentifier.type;
    const contextValue = contextIdentifier.value;
    const certSerial = offlineCertificate.serialNumber;

    const urlWithoutSignature = `${this.baseUrl}/certificate/${contextType}/${contextValue}/${data.sellerNip}/${certSerial}/${hashBase64URL}`;

    const pathToSign = extractPathForSigning(urlWithoutSignature);

    const signatureBase64URL = signAuto(
      pathToSign,
      offlineCertificate.privateKey,
      offlineCertificate.password
    );

    const url = `${urlWithoutSignature}/${signatureBase64URL}`;

    const qrCode = await this.generateQRCode(url, options);

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
    const format: QRCodeFormat = options.format || 'dataurl';
    const opts = this.buildQRCodeOptions(options);

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
        throw new Error(`Unsupported QR code format: ${format}`);
    }

    return {
      data,
      format,
      inputData: url,
      timestamp: new Date().toISOString()
    };
  }

  private buildQRCodeOptions(options: QRCodeOptions): {
    errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
    width: number;
    margin: number;
    color: { dark: string; light: string };
  } {
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

  /** Set environment */
  setEnvironment(environment: ApiV2Environment): void {
    this.environment = environment;
    this.baseUrl = QR_BASE_URLS[environment];
  }

  /** Get current environment */
  getEnvironment(): ApiV2Environment {
    return this.environment;
  }

  /** Get base URL for current environment */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

/** Create QR code service instance */
export function createQRCodeService(environment: ApiV2Environment = 'prod'): QRCodeService {
  return new QRCodeService(environment);
}

