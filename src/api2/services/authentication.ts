import { isIPv4 } from 'node:net';
import { validateAuthorizationPolicy } from '../auth/authorization-policy.js';
import type { HttpClient } from '@/utils/http.js';
import { createRequestBody } from '@/utils/http.js';
import {
  API_V2_BASE_URLS,
  type ApiV2Environment,
  type ContextIdentifier,
  type AuthenticationChallengeResponse,
  type AuthorizationPolicy,
  type AuthenticationInitResponse,
  type AuthenticationOperationStatusResponse,
  type AuthenticationTokenRedeemResponse,
  type AuthenticationTokenRefreshResponse
} from '../types/common.js';
import { SecurityService } from '../security.js';
import { encryptTokenPayload } from '../crypto/token.js';
import type { CertificateCredentials } from '@/types/auth.js';
import { buildSignedAuthTokenRequest, type SubjectIdentifierTypeV2 } from '../auth/xades-request.js';
import { Routes } from '../routes.js';

export interface TokenAuthenticationOptions {
  authorizationPolicy?: AuthorizationPolicy;
  /** @deprecated Use authorizationPolicy. STRICT binds to the challenge IPv4; NONE adds no restriction. */
  ipAddressPolicy?: 'STRICT' | 'NONE';
}

export interface XadesAuthenticationOptions {
  verifyCertificateChain?: boolean;
}

export interface CertificateAuthenticationOptions extends XadesAuthenticationOptions {
  authorizationPolicy?: AuthorizationPolicy;
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
      url: `${this.baseUrl}${Routes.Auth.challenge}`
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
    if (options?.ipAddressPolicy !== undefined && !['STRICT', 'NONE'].includes(options.ipAddressPolicy)) {
      throw new Error('Invalid ipAddressPolicy; use STRICT or NONE');
    }
    if (options?.authorizationPolicy !== undefined && options.ipAddressPolicy !== undefined) {
      throw new Error('Cannot specify both authorizationPolicy and ipAddressPolicy');
    }
    if (options?.authorizationPolicy !== undefined) validateAuthorizationPolicy(options.authorizationPolicy);
    const challenge = await this.requestChallenge();
    let authorizationPolicy = options?.authorizationPolicy;
    if (options?.ipAddressPolicy === 'STRICT') {
      if (!challenge.clientIp || !isIPv4(challenge.clientIp)) {
        throw new Error('STRICT requires an IPv4 clientIp from the authentication challenge');
      }
      authorizationPolicy = { allowedIps: { ip4Addresses: [challenge.clientIp] } };
    }
    const key = typeof this.securityService.getPublicKeyInfo === 'function'
      ? await this.securityService.getPublicKeyInfo('KsefTokenEncryption')
      : { pem: await this.securityService.getPublicKey('KsefTokenEncryption') };
    const encryptedToken = encryptTokenPayload(
      token,
      challenge.timestampMs ?? challenge.timestamp,
      key.pem
    );

    const requestBody = {
      challenge: challenge.challenge,
      contextIdentifier,
      encryptedToken,
      ...(key.publicKeyId ? { publicKeyId: key.publicKeyId } : {}),
      ...(authorizationPolicy ? { authorizationPolicy } : {})
    };

    const response = await this.httpClient.request<AuthenticationInitResponse>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.Auth.ksefToken}`,
      body: createRequestBody(requestBody)
    });
    return response.data;
  }

  async initiateXadesAuthenticationWithCertificate(
    credentials: CertificateCredentials,
    contextIdentifier: ContextIdentifier,
    subjectIdentifierType: SubjectIdentifierTypeV2 = 'certificateSubject',
    options?: CertificateAuthenticationOptions
  ): Promise<AuthenticationInitResponse> {
    if (options?.authorizationPolicy !== undefined) validateAuthorizationPolicy(options.authorizationPolicy);
    const challenge = await this.requestChallenge();
    const signedXml = buildSignedAuthTokenRequest(
      {
        challenge: challenge.challenge,
        contextIdentifier,
        subjectIdentifierType,
        ...(options?.authorizationPolicy ? { authorizationPolicy: options.authorizationPolicy } : {})
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
      url: `${this.baseUrl}${Routes.Auth.xadesSignature}${query}`,
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
      url: `${this.baseUrl}${Routes.Auth.status(referenceNumber)}`,
      headers: {
        'Authorization': `Bearer ${authenticationToken}`
      }
    });
    return response.data;
  }

  async redeemTokens(authenticationToken: string): Promise<AuthenticationTokenRedeemResponse> {
    const response = await this.httpClient.request<AuthenticationTokenRedeemResponse>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.Auth.tokenRedeem}`,
      headers: {
        'Authorization': `Bearer ${authenticationToken}`
      }
    });
    return response.data;
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthenticationTokenRefreshResponse> {
    const response = await this.httpClient.request<AuthenticationTokenRefreshResponse>({
      method: 'POST',
      url: `${this.baseUrl}${Routes.Auth.tokenRefresh}`,
      headers: {
        'Authorization': `Bearer ${refreshToken}`
      },
      skipAuthRetry: true
    });
    return response.data;
  }
}
