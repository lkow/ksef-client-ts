/**
 * Authentication service for KSeF API
 */


import type { 
  AuthorisationChallengeRequest,
  AuthorisationChallengeResponse,
  InitSignedRequest,
  InitTokenRequest,
  SessionResponse,
  SessionToken,
  SessionStatusResponse,
  GenerateTokenRequest,
  GenerateTokenResponse,
  RevokeTokenRequest,
  QueryTokensRequest,
  QueryTokensResponse,
  CertificateCredentials,
  TokenCredentials
} from '@/types/auth.js';
import { 
  isCertificateCredentials,
  isTokenCredentials
} from '@/types/auth.js';
import type { ContextIdentifier, IpAddressPolicy } from '@/types/common.js';
import type { HttpClient, HttpRequestOptions } from '@/utils/http.js';
import { 
  parseCertificate,
  createXMLSignature,
  encryptTokenWithTimestamp,
  validateCertificate,
  type ParsedCertificate
} from '@/utils/crypto.js';
import { AuthenticationError, ProcessError } from '@/types/common.js';
import { createRequestBody } from '@/utils/http.js';
import { Logger } from '@/utils/logger.js';

export class AuthenticationService {
  private httpClient: HttpClient;
  private baseUrl: string;
  private currentSession?: SessionToken;
  private parsedCert?: ParsedCertificate;
  private logger: Logger;

  constructor(httpClient: HttpClient, baseUrl: string, debug = false) {
    this.httpClient = httpClient;
    this.baseUrl = baseUrl;
    this.logger = new Logger({
      debug,
      prefix: '[KSeF Auth]'
    });
  }

  /**
   * Authenticate using certificate or token credentials
   */
  async authenticate(
    credentials: CertificateCredentials | TokenCredentials,
    contextIdentifier: ContextIdentifier,
    ipAddressPolicy?: IpAddressPolicy
  ): Promise<SessionToken> {
    if (isCertificateCredentials(credentials)) {
      return await this.authenticateWithCertificate(credentials, contextIdentifier);
    } else if (isTokenCredentials(credentials)) {
      return await this.authenticateWithToken(credentials, contextIdentifier, ipAddressPolicy);
    } else {
      throw new Error('Invalid credentials type');
    }
  }

  getCurrentSession(): SessionToken | undefined {
    return this.currentSession;
  }

  isAuthenticated(): boolean {
    return !!this.currentSession;
  }

  private async authenticateWithCertificate(
    credentials: CertificateCredentials,
    contextIdentifier: ContextIdentifier
  ): Promise<SessionToken> {
    this.logger.debug('Starting certificate-based authentication');

    // Parse and validate certificate
    this.parsedCert = parseCertificate(credentials);
    const validation = validateCertificate(this.parsedCert);
    
    if (!validation.valid) {
      throw new AuthenticationError(`Certificate validation failed: ${validation.errors.join(', ')}`);
    }

    // Get authorization challenge
    const challengeResponse = await this.getAuthorizationChallenge(contextIdentifier);
    
    // Create signed authentication request
    const signedRequest = this.createSignedAuthRequest(
      challengeResponse,
      contextIdentifier,
      this.parsedCert
    );

    // Initialize signed session
    const sessionResponse = await this.initSignedSession(signedRequest);
    
    this.currentSession = sessionResponse.sessionToken;
    this.logger.debug('Certificate authentication successful');
    return sessionResponse.sessionToken;
  }

  private async authenticateWithToken(
    credentials: TokenCredentials,
    contextIdentifier: ContextIdentifier,
    ipAddressPolicy?: IpAddressPolicy
  ): Promise<SessionToken> {
    this.logger.debug('Starting token-based authentication');

    // Get authorization challenge
    const challengeResponse = await this.getAuthorizationChallenge(contextIdentifier);
    
    // Create encrypted token request
    const encryptedToken = encryptTokenWithTimestamp(
      credentials.token,
      challengeResponse.timestamp
    );

    const tokenRequest: InitTokenRequest = {
      challenge: challengeResponse.challenge,
      contextIdentifier,
      encryptedToken,
      ...(ipAddressPolicy && { ipAddressPolicy })
    };

    // Initialize token session
    const sessionResponse = await this.initTokenSession(tokenRequest);
    
    this.currentSession = sessionResponse.sessionToken;
    this.logger.debug('Token authentication successful');
    return sessionResponse.sessionToken;
  }

  private async getAuthorizationChallenge(
    contextIdentifier: ContextIdentifier
  ): Promise<AuthorisationChallengeResponse> {
    const request: AuthorisationChallengeRequest = {
      contextIdentifier,
      timestamp: new Date().toISOString()
    };

    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Session/AuthorisationChallenge`,
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<AuthorisationChallengeResponse>(requestOptions);
    return response.data;
  }

  private createSignedAuthRequest(
    challengeResponse: AuthorisationChallengeResponse,
    contextIdentifier: ContextIdentifier,
    parsedCert: ParsedCertificate
  ): InitSignedRequest {
    const contentToSign = JSON.stringify({
      contextIdentifier,
      challenge: challengeResponse.challenge,
      timestamp: challengeResponse.timestamp
    });

    const signature = createXMLSignature(contentToSign, parsedCert);

    return {
      challenge: challengeResponse.challenge,
      contextIdentifier,
      signature,
      timestamp: challengeResponse.timestamp
    };
  }

  private async initSignedSession(request: InitSignedRequest): Promise<SessionResponse> {
    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Session/InitSigned`,
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<SessionResponse>(requestOptions);
    return response.data;
  }

  private async initTokenSession(request: InitTokenRequest): Promise<SessionResponse> {
    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Session/InitToken`,
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<SessionResponse>(requestOptions);
    return response.data;
  }

  /**
   * Generate authentication XML for external signing
   * This method creates the XML that needs to be signed by the user's certificate
   */
  async generateAuthenticationXML(
    contextIdentifier: ContextIdentifier
  ): Promise<{ xml: string; challenge: string; timestamp: string }> {
    this.logger.debug('Generating authentication XML for external signing');

    // Get authorization challenge
    const challengeResponse = await this.getAuthorizationChallenge(contextIdentifier);
    
    // Create the content to be signed
    const contentToSign = JSON.stringify({
      contextIdentifier,
      challenge: challengeResponse.challenge,
      timestamp: challengeResponse.timestamp
    });

    // Generate the XML structure that needs to be signed
    const xmlToSign = this.createXMLToSign(contentToSign);
    
    return {
      xml: xmlToSign,
      challenge: challengeResponse.challenge,
      timestamp: challengeResponse.timestamp
    };
  }

  /**
   * Authenticate using externally signed XML
   * This method accepts XML that has been signed by the user's certificate
   */
  async authenticateWithSignedXML(
    signedXML: string,
    contextIdentifier: ContextIdentifier
  ): Promise<SessionToken> {
    this.logger.debug('Authenticating with externally signed XML');

    // Validate the signed XML structure
    if (!this.isValidSignedXML(signedXML)) {
      throw new AuthenticationError('Invalid signed XML structure');
    }

    // Extract challenge and timestamp from the signed XML
    const { challenge, timestamp } = this.extractChallengeFromSignedXML(signedXML);

    // Create the signed request
    const signedRequest: InitSignedRequest = {
      challenge,
      contextIdentifier,
      signature: signedXML,
      timestamp
    };

    // Initialize signed session
    const sessionResponse = await this.initSignedSession(signedRequest);
    
    this.currentSession = sessionResponse.sessionToken;
    this.logger.debug('External signature authentication successful');
    return sessionResponse.sessionToken;
  }

  /**
   * Create XML structure that needs to be signed
   */
  private createXMLToSign(content: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<InitSessionSignedRequest xmlns="http://ksef.mf.gov.pl/schema/gtw/svc/online/auth/request/202310/v1">
  <Context>${content}</Context>
</InitSessionSignedRequest>`;
  }

  /**
   * Validate that the XML has the correct structure for KSeF authentication
   */
  private isValidSignedXML(xml: string): boolean {
    // Basic validation - check for required elements
    const hasInitSessionSignedRequest = xml.includes('<InitSessionSignedRequest');
    const hasContext = xml.includes('<Context>');
    const hasSignature = xml.includes('<Signature');
    const hasSignatureValue = xml.includes('<SignatureValue>');
    const hasX509Certificate = xml.includes('<X509Certificate>');
    
    return hasInitSessionSignedRequest && hasContext && hasSignature && hasSignatureValue && hasX509Certificate;
  }

  /**
   * Extract challenge and timestamp from signed XML
   */
  private extractChallengeFromSignedXML(signedXML: string): { challenge: string; timestamp: string } {
    try {
      // Extract the Context content from the signed XML
      const contextMatch = signedXML.match(/<Context>(.*?)<\/Context>/s);
      if (!contextMatch || !contextMatch[1]) {
        throw new Error('Could not extract Context from signed XML');
      }

      const contextContent = contextMatch[1];
      const contextData = JSON.parse(contextContent);

      return {
        challenge: contextData.challenge,
        timestamp: contextData.timestamp
      };
    } catch (error) {
      throw new AuthenticationError(`Failed to extract challenge from signed XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a new authorization token
   * This creates a reusable token that can be used for session initiation
   */
  async generateToken(
    credentials: CertificateCredentials,
    contextIdentifier: ContextIdentifier,
    description?: string
  ): Promise<GenerateTokenResponse> {
    this.logger.debug('Generating new authorization token');

    // Parse and validate certificate
    const parsedCert = parseCertificate(credentials);
    const validation = validateCertificate(parsedCert);
    
    if (!validation.valid) {
      throw new AuthenticationError(`Certificate validation failed: ${validation.errors.join(', ')}`);
    }

    // Get authorization challenge
    const challengeResponse = await this.getAuthorizationChallenge(contextIdentifier);
    
    // Create signed XML for token generation
    const content = JSON.stringify({
      challenge: challengeResponse.challenge,
      timestamp: challengeResponse.timestamp,
      contextIdentifier
    });
    
    const xmlToSign = this.createXMLToSign(content);
    const signedXML = createXMLSignature(xmlToSign, parsedCert);

    const request: GenerateTokenRequest = {
      description: description || 'Generated token'
    };

    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Credentials/GenerateToken`,
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<GenerateTokenResponse>(requestOptions);
    this.logger.debug('Token generation initiated');
    return response.data;
  }

  /**
   * Revoke an existing authorization token
   */
  async revokeToken(
    tokenNumber: string,
    sessionToken: SessionToken
  ): Promise<void> {
    this.logger.debug(`Revoking token: ${tokenNumber}`);

    const request: RevokeTokenRequest = {
      tokenNumber
    };

    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Credentials/RevokeToken`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      },
      body: createRequestBody(request)
    };

    await this.httpClient.request(requestOptions);
    this.logger.debug('Token revoked successfully');
  }

  /**
   * Query all active tokens for a context
   */
  async queryTokens(
    contextIdentifier: ContextIdentifier,
    sessionToken: SessionToken,
    includeDetails = false
  ): Promise<QueryTokensResponse> {
    this.logger.debug('Querying active tokens');

    const request: QueryTokensRequest = {
      contextIdentifier,
      includeDetails
    };

    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      url: `${this.baseUrl}/online/Credentials/QueryTokens`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      },
      body: createRequestBody(request)
    };

    const response = await this.httpClient.request<QueryTokensResponse>(requestOptions);
    this.logger.debug(`Found ${response.data.tokenList?.length || 0} active tokens`);
    return response.data;
  }

  /**
   * Get the status of a token generation request
   */
  async getTokenGenerationStatus(
    elementReferenceNumber: string,
    sessionToken: SessionToken
  ): Promise<GenerateTokenResponse> {
    const requestOptions: HttpRequestOptions = {
      method: 'GET',
      url: `${this.baseUrl}/online/Credentials/Status/${elementReferenceNumber}`,
      headers: {
        'SessionToken': `Token ${sessionToken.token}`
      }
    };

    const response = await this.httpClient.request<GenerateTokenResponse>(requestOptions);
    return response.data;
  }

} 