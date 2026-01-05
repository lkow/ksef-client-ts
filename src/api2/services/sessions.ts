import type { HttpClient } from '@/utils/http.js';
import { createRequestBody, buildQueryString } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment,
  type FormCode,
  type UpoVersion,
  type OpenOnlineSessionResponse,
  type OpenBatchSessionRequest,
  type OpenBatchSessionResponse,
  type BatchFileInfo,
  type PartUploadRequest
} from '../types/common.js';
import { SecurityService } from '../security.js';
import { SymmetricKeyManager, type SymmetricKeyMaterial } from '../crypto/symmetric.js';
import type {
  SessionStatusResponse,
  SessionInvoicesResponse,
  SessionInvoiceStatus,
  UpoDownloadResult
} from '../types/session.js';

export interface OpenOnlineSessionOptions {
  /**
   * Provide a pre-generated symmetric key if you want to reuse one across sessions.
   * If omitted a fresh key will be generated automatically.
   */
  encryptionMaterial?: SymmetricKeyMaterial;
  /**
   * Select UPO version for the session (header: X-KSeF-Feature).
   * If omitted, the server default applies (v4-3 from 2025-12-22).
   */
  upoVersion?: UpoVersion;
}

export interface OpenOnlineSessionResult extends OpenOnlineSessionResponse {
  encryptionMaterial: SymmetricKeyMaterial;
}

export interface OpenBatchSessionOptions {
  encryptionMaterial?: SymmetricKeyMaterial;
  /**
   * Select UPO version for the session (header: X-KSeF-Feature).
   * If omitted, the server default applies (v4-3 from 2025-12-22).
   */
  upoVersion?: UpoVersion;
}

export interface OpenBatchSessionResult extends OpenBatchSessionResponse {
  encryptionMaterial: SymmetricKeyMaterial;
}

export class SessionV2Service {
  private readonly baseUrl: string;
  private readonly securityService: SecurityService;
  private readonly symmetricManager: SymmetricKeyManager;

  constructor(
    private readonly httpClient: HttpClient,
    environment: ApiV2Environment,
    securityService?: SecurityService
  ) {
    this.baseUrl = API_V2_BASE_URLS[environment];
    this.securityService = securityService ?? new SecurityService(httpClient, environment);
    this.symmetricManager = new SymmetricKeyManager(this.securityService);
  }

  /**
   * Opens an interactive session using the AES key negotiation described in
   * https://github.com/CIRFMF/ksef-docs/blob/main/sesja-interaktywna.md#1-otwarcie-sesji .
   */
  async openOnlineSession(
    accessToken: string,
    formCode: FormCode,
    options: OpenOnlineSessionOptions = {}
  ): Promise<OpenOnlineSessionResult> {
    const encryptionMaterial = options.encryptionMaterial ?? await this.symmetricManager.createMaterial();

    const requestBody = {
      formCode,
      encryption: {
        encryptedSymmetricKey: encryptionMaterial.encryptedSymmetricKey,
        initializationVector: encryptionMaterial.initializationVectorBase64
      }
    };

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`
    };
    if (options.upoVersion) {
      headers['X-KSeF-Feature'] = options.upoVersion;
    }

    const response = await this.httpClient.request<OpenOnlineSessionResponse>({
      method: 'POST',
      url: `${this.baseUrl}/sessions/online`,
      headers,
      body: createRequestBody(requestBody)
    });

    return {
      ...response.data,
      encryptionMaterial
    };
  }

  async closeOnlineSession(accessToken: string, referenceNumber: string): Promise<void> {
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/sessions/online/${referenceNumber}/close`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  }

  async openBatchSession(
    accessToken: string,
    batchFile: BatchFileInfo,
    formCode: FormCode,
    options: OpenBatchSessionOptions = {}
  ): Promise<OpenBatchSessionResult> {
    const encryptionMaterial = options.encryptionMaterial ?? await this.symmetricManager.createMaterial();
    const requestBody: OpenBatchSessionRequest = {
      formCode,
      batchFile,
      encryption: {
        encryptedSymmetricKey: encryptionMaterial.encryptedSymmetricKey,
        initializationVector: encryptionMaterial.initializationVectorBase64
      }
    };

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`
    };
    if (options.upoVersion) {
      headers['X-KSeF-Feature'] = options.upoVersion;
    }

    const response = await this.httpClient.request<OpenBatchSessionResponse>({
      method: 'POST',
      url: `${this.baseUrl}/sessions/batch`,
      headers,
      body: createRequestBody(requestBody)
    });

    return {
      ...response.data,
      encryptionMaterial
    };
  }

  async closeBatchSession(accessToken: string, referenceNumber: string): Promise<void> {
    await this.httpClient.request({
      method: 'POST',
      url: `${this.baseUrl}/sessions/batch/${referenceNumber}/close`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  }

  async getSessionStatus(
    accessToken: string,
    referenceNumber: string
  ): Promise<SessionStatusResponse> {
    const response = await this.httpClient.request<SessionStatusResponse>({
      method: 'GET',
      url: `${this.baseUrl}/sessions/${referenceNumber}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }

  async listSessionInvoices(
    accessToken: string,
    referenceNumber: string,
    options: { continuationToken?: string; pageSize?: number } = {}
  ): Promise<SessionInvoicesResponse> {
    const query = options.pageSize ? buildQueryString({ pageSize: options.pageSize }) : '';
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`
    };

    if (options.continuationToken) {
      headers['x-continuation-token'] = options.continuationToken;
    }

    const response = await this.httpClient.request<SessionInvoicesResponse>({
      method: 'GET',
      url: `${this.baseUrl}/sessions/${referenceNumber}/invoices${query}`,
      headers
    });

    return response.data;
  }

  async listFailedSessionInvoices(
    accessToken: string,
    referenceNumber: string,
    options: { continuationToken?: string; pageSize?: number } = {}
  ): Promise<SessionInvoicesResponse> {
    const query = options.pageSize ? buildQueryString({ pageSize: options.pageSize }) : '';
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`
    };

    if (options.continuationToken) {
      headers['x-continuation-token'] = options.continuationToken;
    }

    const response = await this.httpClient.request<SessionInvoicesResponse>({
      method: 'GET',
      url: `${this.baseUrl}/sessions/${referenceNumber}/invoices/failed${query}`,
      headers
    });

    return response.data;
  }

  async getInvoiceStatus(
    accessToken: string,
    referenceNumber: string,
    invoiceReferenceNumber: string
  ): Promise<SessionInvoiceStatus> {
    const response = await this.httpClient.request<SessionInvoiceStatus>({
      method: 'GET',
      url: `${this.baseUrl}/sessions/${referenceNumber}/invoices/${invoiceReferenceNumber}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }

  async downloadInvoiceUpoByKsef(
    accessToken: string,
    referenceNumber: string,
    ksefNumber: string
  ): Promise<string> {
    const result = await this.downloadInvoiceUpoByKsefWithHash(accessToken, referenceNumber, ksefNumber);
    return result.xml;
  }

  async downloadInvoiceUpoByKsefWithHash(
    accessToken: string,
    referenceNumber: string,
    ksefNumber: string
  ): Promise<UpoDownloadResult> {
    return await this.downloadUpoWithHash(
      accessToken,
      `${this.baseUrl}/sessions/${referenceNumber}/invoices/ksef/${ksefNumber}/upo`
    );
  }

  async downloadInvoiceUpoByReference(
    accessToken: string,
    referenceNumber: string,
    invoiceReferenceNumber: string
  ): Promise<string> {
    const result = await this.downloadInvoiceUpoByReferenceWithHash(accessToken, referenceNumber, invoiceReferenceNumber);
    return result.xml;
  }

  async downloadInvoiceUpoByReferenceWithHash(
    accessToken: string,
    referenceNumber: string,
    invoiceReferenceNumber: string
  ): Promise<UpoDownloadResult> {
    return await this.downloadUpoWithHash(
      accessToken,
      `${this.baseUrl}/sessions/${referenceNumber}/invoices/${invoiceReferenceNumber}/upo`
    );
  }

  async downloadSessionUpo(
    accessToken: string,
    referenceNumber: string,
    upoReferenceNumber: string
  ): Promise<string> {
    const result = await this.downloadSessionUpoWithHash(accessToken, referenceNumber, upoReferenceNumber);
    return result.xml;
  }

  async downloadSessionUpoWithHash(
    accessToken: string,
    referenceNumber: string,
    upoReferenceNumber: string
  ): Promise<UpoDownloadResult> {
    return await this.downloadUpoWithHash(
      accessToken,
      `${this.baseUrl}/sessions/${referenceNumber}/upo/${upoReferenceNumber}`
    );
  }

  private async downloadUpoWithHash(
    accessToken: string,
    url: string
  ): Promise<UpoDownloadResult> {
    const response = await this.httpClient.request<string>({
      method: 'GET',
      url,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return {
      xml: response.data,
      hash: response.headers['x-ms-meta-hash'] ?? null
    };
  }
}

export class BatchSessionUploader {
  async uploadPart(
    uploadRequest: PartUploadRequest,
    payload: Buffer
  ): Promise<void> {
    const fetchImpl = globalThis.fetch;
    if (!fetchImpl) {
      throw new Error('Global fetch is not available. Please provide a polyfill (Node 18+ required).');
    }

    const response = await fetchImpl(uploadRequest.url, {
      method: uploadRequest.method,
      headers: uploadRequest.headers,
      body: new Uint8Array(payload)
    });
    if (!response.ok) {
      throw new Error(`Failed to upload batch part #${uploadRequest.ordinalNumber}: ${response.status} ${response.statusText}`);
    }
  }
}
