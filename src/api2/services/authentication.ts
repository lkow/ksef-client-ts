import type { HttpClient } from '@/utils/http.js';
import { createRequestBody } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment,
  type ContextIdentifier,
  type AuthenticationChallengeResponse,
  type AuthenticationInitResponse,
  type AuthenticationOperationStatusResponse,
  type AuthenticationTokenRedeemResponse,
  type AuthenticationTokenRefreshResponse
} from '../types/common.js';
import { SecurityService } from '../security.js';
import { encryptTokenPayload } from '../crypto/token.js';
import type { CertificateCredentials } from '@/types/auth.js';
import { buildSignedAuthTokenRequest, type SubjectIdentifierTypeV2 } from '../auth/xades-request.js';

export interface TokenAuthenticationOptions {
  /**
   * Optional IP address policy propagated to /auth/ksef-token.
   * Matches documentation in https://github.com/CIRFMF/ksef-docs/blob/main/uwierzytelnianie.md
   */
  ipAddressPolicy?: 'STRICT' | 'NONE';
}

export interface XadesAuthenticationOptions {
  verifyCertificateChain?: boolean;
}

/**
 * Implements the API 2.0 authentication flow (challenge -> init -> poll -> redeem -> refresh).
 * All operations are described in https://api-test.ksef.mf.gov.pl/docs/v2/index.html#tag/Uzyskiwanie-dostepu
 */
export class AuthenticationV2Service {
  private readonly baseUrl: string;
  private readonly securityService: SecurityService;

  constructor(
    private readonly httpClient: HttpClient,
    environment: ApiV2Environment,
    securityService?: SecurityService
  ) {
    this.baseUrl = API_V2_BASE_URLS[environment];
    this.securityService = securityService ?? new SecurityService(httpClient, environment);
  }

  async requestChallenge(): Promise<AuthenticationChallengeResponse> {
    const response = await this.httpClient.request<AuthenticationChallengeResponse>({
      method: 'POST',
      url: `${this.baseUrl}/auth/challenge`
    });
    return response.data;
  }

  /**
   * Initiates authentication using a pre-generated KSeF token.
   * Automatically encrypts `token|timestamp` payload with RSA-OAEP using the
   * public key advertised for `KsefTokenEncryption`.
   */
  async initiateTokenAuthentication(
    contextIdentifier: ContextIdentifier,
    token: string,
    options?: TokenAuthenticationOptions
  ): Promise<AuthenticationInitResponse> {
    const challenge = await this.requestChallenge();
    const tokenEncryptionKey = await this.securityService.getPublicKey('KsefTokenEncryption');
    const encryptedToken = encryptTokenPayload(
      token,
      challenge.timestampMs ?? challenge.timestamp,
      tokenEncryptionKey
    );

    const requestBody = {
      challenge: challenge.challenge,
      contextIdentifier,
      encryptedToken,
      ...(options?.ipAddressPolicy ? { ipAddressPolicy: options.ipAddressPolicy } : {})
    };

    const response = await this.httpClient.request<AuthenticationInitResponse>({
      method: 'POST',
      url: `${this.baseUrl}/auth/ksef-token`,
      body: createRequestBody(requestBody)
    });
    return response.data;
  }

  async initiateXadesAuthenticationWithCertificate(
    credentials: CertificateCredentials,
    contextIdentifier: ContextIdentifier,
    subjectIdentifierType: SubjectIdentifierTypeV2 = 'certificateSubject',
    options?: XadesAuthenticationOptions
  ): Promise<AuthenticationInitResponse> {
    const challenge = await this.requestChallenge();
    const signedXml = buildSignedAuthTokenRequest(
      {
        challenge: challenge.challenge,
        contextIdentifier,
        subjectIdentifierType
      },
      credentials
    );

    return await this.initiateXadesAuthentication(signedXml, undefined, options);
  }

  /**
   * Starts authentication using a signed AuthTokenRequest (XAdES).
   * The payload should already contain the signature created according to
   * https://github.com/CIRFMF/ksef-docs/blob/main/uwierzytelnianie.md#21-uwierzytelnianie-kwalifikowanym-podpisem-elektronicznym
   */
  async initiateXadesAuthentication(
    signedAuthTokenRequestXml: string,
    authenticationToken?: string,
    options?: XadesAuthenticationOptions
  ): Promise<AuthenticationInitResponse> {
    const query = options?.verifyCertificateChain ? '?verifyCertificateChain=true' : '';
    const response = await this.httpClient.request<AuthenticationInitResponse>({
      method: 'POST',
      url: `${this.baseUrl}/auth/xades-signature${query}`,
      headers: {
        'Content-Type': 'application/xml',
        ...(authenticationToken ? { 'Authorization': `Bearer ${authenticationToken}` } : {})
      },
      body: signedAuthTokenRequestXml
    });
    return response.data;
  }

  async getAuthenticationStatus(
    referenceNumber: string,
    authenticationToken: string
  ): Promise<AuthenticationOperationStatusResponse> {
    const response = await this.httpClient.request<AuthenticationOperationStatusResponse>({
      method: 'GET',
      url: `${this.baseUrl}/auth/${referenceNumber}`,
      headers: {
        'Authorization': `Bearer ${authenticationToken}`
      }
    });
    return response.data;
  }

  async redeemTokens(authenticationToken: string): Promise<AuthenticationTokenRedeemResponse> {
    const response = await this.httpClient.request<AuthenticationTokenRedeemResponse>({
      method: 'POST',
      url: `${this.baseUrl}/auth/token/redeem`,
      headers: {
        'Authorization': `Bearer ${authenticationToken}`
      }
    });
    return response.data;
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthenticationTokenRefreshResponse> {
    const response = await this.httpClient.request<AuthenticationTokenRefreshResponse>({
      method: 'POST',
      url: `${this.baseUrl}/auth/token/refresh`,
      headers: {
        'Authorization': `Bearer ${refreshToken}`
      }
    });
    return response.data;
  }
}
