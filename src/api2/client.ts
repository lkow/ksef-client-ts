import type { HttpClient } from '@/utils/http.js';
import { HttpClient as DefaultHttpClient } from '@/utils/http.js';
import type { ApiV2Environment, ContextIdentifier, FormCode } from './types/common.js';
import type { CertificateCredentials, TokenCredentials } from '@/types/auth.js';
import { AuthenticationV2Service } from './services/authentication.js';
import {
  SessionV2Service,
  BatchSessionUploader,
  type OpenOnlineSessionOptions,
  type OpenBatchSessionOptions
} from './services/sessions.js';
import { InvoiceV2Service } from './services/invoice.js';
import { PermissionsV2Service } from './services/permissions.js';
import { TokenService } from './services/token.js';
import { RateLimitsService } from './services/rate-limits.js';
import { TestDataService } from './services/test-data.js';
import { PeppolService } from './services/peppol.js';
import { CertificateService } from './services/certificates.js';
import {
  encryptInvoicePayload,
  encryptInvoiceCorrectionPayload,
  sha256Base64,
  type EncryptedInvoicePayload
} from './crypto/encryption.js';
import type { SymmetricKeyMaterial } from './crypto/symmetric.js';
import type {
  ExportInvoicesResponse,
  InvoiceExportRequest,
  InvoiceExportStatusResponse,
  InvoiceQueryFilters,
  QueryInvoicesMetadataResponse,
  SendInvoiceResponse,
  SortOrder
} from './types/invoice.js';
import type { SessionStatusResponse, SessionInvoicesResponse } from './types/session.js';
import type { FormCode as BatchFormCode, PartUploadRequest } from './types/common.js';
import type { BatchFileBuildResult } from './batch.js';
import { BatchFileBuilder } from './batch.js';

export interface KsefApiV2ClientOptions {
  environment: ApiV2Environment;
  httpClient?: HttpClient;
}

export class KsefApiV2Client {
  readonly authentication: AuthenticationV2Service;
  readonly sessions: SessionV2Service;
  readonly invoices: InvoiceV2Service;
  readonly batchUploader: BatchSessionUploader;
  readonly permissions: PermissionsV2Service;
  readonly tokens: TokenService;
  readonly rateLimits: RateLimitsService;
  readonly peppol: PeppolService;
  readonly certificates: CertificateService;
  readonly testData?: TestDataService;
  readonly httpClient: HttpClient;

  constructor(options: KsefApiV2ClientOptions) {
    this.httpClient = options.httpClient ?? new DefaultHttpClient();
    this.authentication = new AuthenticationV2Service(this.httpClient, options.environment);
    this.sessions = new SessionV2Service(this.httpClient, options.environment);
    this.invoices = new InvoiceV2Service(this.httpClient, options.environment);
    this.permissions = new PermissionsV2Service(this.httpClient, options.environment);
    this.tokens = new TokenService(this.httpClient, options.environment);
    this.rateLimits = new RateLimitsService(this.httpClient, options.environment);
    this.peppol = new PeppolService(this.httpClient, options.environment);
    this.certificates = new CertificateService(this.httpClient, options.environment);
    this.batchUploader = new BatchSessionUploader();
    if (options.environment === 'test') {
      this.testData = new TestDataService(this.httpClient, options.environment);
    }
  }

  async authenticateWithToken(
    credentials: TokenCredentials,
    contextIdentifier: ContextIdentifier
  ) {
    const init = await this.authentication.initiateTokenAuthentication(
      contextIdentifier,
      credentials.token
    );
    return init;
  }

  async authenticateWithCertificate(
    credentials: CertificateCredentials,
    contextIdentifier: ContextIdentifier
  ) {
    return await this.authentication.initiateXadesAuthenticationWithCertificate(
      credentials,
      contextIdentifier
    );
  }

  async createOnlineSession(
    accessToken: string,
    formCode: FormCode,
    options?: OpenOnlineSessionOptions
  ) {
    return await this.sessions.openOnlineSession(accessToken, formCode, options);
  }

  async createBatchSession(
    accessToken: string,
    formCode: BatchFormCode,
    batchBuffer: Buffer,
    partSize?: number
  ): Promise<{ session: Awaited<ReturnType<SessionV2Service['openBatchSession']>>; batchParts: BatchFileBuildResult['parts'] }>;
  async createBatchSession(
    accessToken: string,
    formCode: BatchFormCode,
    batchBuffer: Buffer,
    options?: { partSize?: number; session?: OpenBatchSessionOptions }
  ): Promise<{ session: Awaited<ReturnType<SessionV2Service['openBatchSession']>>; batchParts: BatchFileBuildResult['parts'] }>;
  async createBatchSession(
    accessToken: string,
    formCode: BatchFormCode,
    batchBuffer: Buffer,
    partSizeOrOptions?: number | { partSize?: number; session?: OpenBatchSessionOptions }
  ): Promise<{ session: Awaited<ReturnType<SessionV2Service['openBatchSession']>>; batchParts: BatchFileBuildResult['parts'] }> {
    const partSize = typeof partSizeOrOptions === 'number' ? partSizeOrOptions : partSizeOrOptions?.partSize;
    const sessionOptions = typeof partSizeOrOptions === 'number' ? undefined : partSizeOrOptions?.session;

    const builder = new BatchFileBuilder(batchBuffer);
    const batch = builder.build(partSize);
    const session = await this.sessions.openBatchSession(accessToken, batch.batchFile, formCode, sessionOptions);
    return { session, batchParts: batch.parts };
  }

  async uploadBatchParts(
    uploadRequests: PartUploadRequest[],
    parts: Buffer[]
  ): Promise<void> {
    if (uploadRequests.length !== parts.length) {
      throw new Error('Number of upload requests does not match provided parts');
    }

    for (let i = 0; i < uploadRequests.length; i++) {
      const request = uploadRequests[i]!;
      const part = parts[i]!;
      await this.batchUploader.uploadPart(request, part);
    }
  }

  encryptInvoice(
    invoiceXml: string | Buffer,
    encryptionMaterial: SymmetricKeyMaterial,
    options?: { offlineMode?: boolean }
  ): EncryptedInvoicePayload {
    return encryptInvoicePayload(invoiceXml, encryptionMaterial, options);
  }

  encryptInvoiceCorrection(
    invoiceXml: string | Buffer,
    correctedInvoiceXml: string | Buffer,
    encryptionMaterial: SymmetricKeyMaterial,
    options?: { offlineMode?: boolean }
  ): EncryptedInvoicePayload {
    return encryptInvoiceCorrectionPayload(invoiceXml, correctedInvoiceXml, encryptionMaterial, options);
  }

  async sendInvoice(
    accessToken: string,
    sessionReference: string,
    encryptedInvoice: EncryptedInvoicePayload
  ): Promise<SendInvoiceResponse> {
    return await this.invoices.sendInvoice(accessToken, sessionReference, encryptedInvoice);
  }

  async queryInvoiceMetadata(
    accessToken: string,
    filters: InvoiceQueryFilters,
    options?: { pageOffset?: number; pageSize?: number; sortOrder?: SortOrder }
  ): Promise<QueryInvoicesMetadataResponse> {
    return await this.invoices.queryMetadata(accessToken, filters, options);
  }

  async exportInvoices(
    accessToken: string,
    request: InvoiceExportRequest
  ): Promise<ExportInvoicesResponse> {
    return await this.invoices.exportInvoices(accessToken, request);
  }

  async getInvoiceExportStatus(
    accessToken: string,
    referenceNumber: string
  ): Promise<InvoiceExportStatusResponse> {
    return await this.invoices.getInvoiceExportStatus(accessToken, referenceNumber);
  }

  async closeOnlineSession(accessToken: string, referenceNumber: string): Promise<void> {
    await this.sessions.closeOnlineSession(accessToken, referenceNumber);
  }

  async getSessionStatus(accessToken: string, referenceNumber: string): Promise<SessionStatusResponse> {
    return await this.sessions.getSessionStatus(accessToken, referenceNumber);
  }

  async listSessionInvoices(
    accessToken: string,
    referenceNumber: string,
    options?: { continuationToken?: string; pageSize?: number }
  ): Promise<SessionInvoicesResponse> {
    return await this.sessions.listSessionInvoices(accessToken, referenceNumber, options);
  }

  computeHashBase64(content: Buffer | string): string {
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    return sha256Base64(buffer);
  }
}
