import type { HttpClient } from '@/utils/http.js';
import { buildQueryString, createRequestBody } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment
} from '../types/common.js';
import type {
  CertificateLimitsResponse,
  CertificateEnrollmentDataResponse,
  EnrollCertificateRequest,
  EnrollCertificateResponse,
  CertificateEnrollmentStatusResponse,
  RetrieveCertificatesRequest,
  RetrieveCertificatesResponse,
  RevokeCertificateRequest,
  QueryCertificatesRequest,
  QueryCertificatesResponse
} from '../types/certificates.js';

export class CertificateService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpClient: HttpClient,
    environment: ApiV2Environment
  ) {
    this.baseUrl = API_V2_BASE_URLS[environment];
  }

  async getLimits(accessToken: string): Promise<CertificateLimitsResponse> {
    const response = await this.httpClient.request<CertificateLimitsResponse>({
      method: 'GET',
      url: `${this.baseUrl}/certificates/limits`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }

  async getEnrollmentData(accessToken: string): Promise<CertificateEnrollmentDataResponse> {
    const response = await this.httpClient.request<CertificateEnrollmentDataResponse>({
      method: 'GET',
      url: `${this.baseUrl}/certificates/enrollments/data`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }

  async submitEnrollment(
    accessToken: string,
    request: EnrollCertificateRequest
  ): Promise<EnrollCertificateResponse> {
    const response = await this.httpClient.request<EnrollCertificateResponse>({
      method: 'POST',
      url: `${this.baseUrl}/certificates/enrollments`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async getEnrollmentStatus(
    accessToken: string,
    referenceNumber: string
  ): Promise<CertificateEnrollmentStatusResponse> {
    const response = await this.httpClient.request<CertificateEnrollmentStatusResponse>({
      method: 'GET',
      url: `${this.baseUrl}/certificates/enrollments/${referenceNumber}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  }

  async retrieveCertificates(
    accessToken: string,
    request: RetrieveCertificatesRequest
  ): Promise<RetrieveCertificatesResponse> {
    const response = await this.httpClient.request<RetrieveCertificatesResponse>({
      method: 'POST',
      url: `${this.baseUrl}/certificates/retrieve`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }

  async revokeCertificate(
    accessToken: string,
    certificateSerialNumber: string,
    request?: RevokeCertificateRequest
  ): Promise<void> {
    const options: Parameters<typeof this.httpClient.request>[0] = {
      method: 'POST',
      url: `${this.baseUrl}/certificates/${certificateSerialNumber}/revoke`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };
    if (request) {
      options.body = createRequestBody(request);
    }
    await this.httpClient.request(options);
  }

  async queryCertificates(
    accessToken: string,
    request: QueryCertificatesRequest,
    options: { pageOffset?: number; pageSize?: number } = {}
  ): Promise<QueryCertificatesResponse> {
    const query = buildQueryString({
      pageOffset: options.pageOffset ?? 0,
      pageSize: options.pageSize ?? 10
    });
    const response = await this.httpClient.request<QueryCertificatesResponse>({
      method: 'POST',
      url: `${this.baseUrl}/certificates/query${query}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createRequestBody(request)
    });

    return response.data;
  }
}

