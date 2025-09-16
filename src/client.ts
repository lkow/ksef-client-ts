/**
 * Main KSeF client class
 */

import type { KsefClientConfig, ExternalSigningConfig } from '@/types/config.js';
import type { SessionToken, AuthCredentials, CertificateCredentials, TokenCredentials } from '@/types/auth.js';
import type { 
  InvoiceSubmissionResult, 
  QueryInvoiceRequest, 
  PagedInvoiceResponse,
  GetInvoiceResponse,
  UpoResponse,
  AsyncQueryInvoiceRequest,
  BatchSubmissionResult
} from '@/types/invoice.js';
import type { 
  QueryPermissionsResponse,
  RoleType
} from '@/types/permissions.js';
import type { ContextIdentifier } from '@/types/common.js';
import { KSEF_ENVIRONMENTS, KsefApiError } from '@/types/common.js';
import { createHttpClient } from '@/utils/http.js';
import { Logger } from '@/utils/logger.js';
import { AuthenticationService } from '@/services/auth.js';
import { InvoiceService } from '@/services/invoice.js';
import { PermissionsService } from '@/services/permissions.js';
import { BatchService } from '@/services/batch.js';

export class KsefClient {
  private config: KsefClientConfig;
  private authService: AuthenticationService;
  private invoiceService: InvoiceService;
  private permissionsService: PermissionsService;
  private batchService: BatchService;
  private logger: Logger;

  constructor(config: KsefClientConfig) {
    this.config = config;
    
    // Initialize optimized logger
    this.logger = new Logger({
      debug: config.debug || false,
      prefix: '[KSeF Client]'
    });
    
    // Resolve environment configuration
    const environment = typeof config.environment === 'string' 
      ? KSEF_ENVIRONMENTS[config.environment]
      : config.environment;

    if (!environment) {
      throw new Error(`Invalid environment configuration`);
    }

    // Create HTTP client
    const httpClient = createHttpClient(config.httpOptions);

    // Initialize services
    this.authService = new AuthenticationService(
      httpClient,
      environment.baseUrl,
      config.debug || false
    );

    this.invoiceService = new InvoiceService(
      httpClient,
      environment.baseUrl,
      config.debug || false
    );

    this.permissionsService = new PermissionsService(
      httpClient,
      environment.baseUrl,
      config.debug || false
    );

    this.batchService = new BatchService(
      httpClient,
      environment.baseUrl,
      config.debug || false
    );

    this.logger.debug('Initialized for environment:', environment.name);
  }

  /**
   * Authenticate with KSeF using configured credentials
   */
  async login(): Promise<SessionToken> {
    this.logger.debug('Authenticating with KSeF');
    
    if (!this.config.credentials) {
      throw new Error('No credentials configured. Use generateAuthenticationXML() for external signing.');
    }
    
    const sessionToken = await this.authService.authenticate(
      this.config.credentials,
      this.config.contextIdentifier
    );

    this.logger.debug('Authentication successful');
    
    return sessionToken;
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  /**
   * Get current session token
   */
  getCurrentSession(): SessionToken | undefined {
    return this.authService.getCurrentSession();
  }

  /**
   * Submit a single invoice
   */
  async submitInvoice(invoiceXml: string): Promise<InvoiceSubmissionResult> {
    const session = await this.ensureAuthenticated();
    return await this.invoiceService.submitInvoice(invoiceXml, session);
  }

  /**
   * Get an invoice by KSeF reference number
   */
  async getInvoice(ksefReferenceNumber: string): Promise<GetInvoiceResponse> {
    const session = await this.ensureAuthenticated();
    return await this.invoiceService.getInvoice(ksefReferenceNumber, session);
  }

  /**
   * Query invoices with filters
   */
  async queryInvoices(request: QueryInvoiceRequest): Promise<PagedInvoiceResponse> {
    const session = await this.ensureAuthenticated();
    return await this.invoiceService.queryInvoices(request, session);
  }

  /**
   * Authenticate with custom credentials (for integration testing)
   */
  async authenticate(
    credentials: CertificateCredentials | TokenCredentials,
    contextIdentifier?: ContextIdentifier
  ): Promise<SessionToken> {
    this.logger.debug('Authenticating with custom credentials');
    
    const context = contextIdentifier || this.config.contextIdentifier;
    const sessionToken = await this.authService.authenticate(credentials, context);

    this.logger.debug('Custom authentication successful');
    return sessionToken;
  }

  /**
   * Logout/terminate current session
   */
  async logout(): Promise<void> {
    const session = this.authService.getCurrentSession();
    if (session) {
      // Note: KSeF sessions typically expire automatically, explicit logout may not be available
      // For now, we just clear the local session
      (this.authService as any).currentSession = undefined;
      this.logger.debug('Session terminated');
    }
  }

  /**
   * Generate authentication token
   */
  async generateAuthToken(description?: string): Promise<string> {
    const session = await this.ensureAuthenticated();
    // Note: This functionality would need to be implemented in AuthenticationService
    throw new Error('Token generation not yet implemented in AuthenticationService');
  }

  /**
   * Revoke authentication token
   */
  async revokeAuthToken(token: string): Promise<void> {
    const session = await this.ensureAuthenticated();
    // Note: This functionality would need to be implemented in AuthenticationService
    throw new Error('Token revocation not yet implemented in AuthenticationService');
  }

  /**
   * Submit multiple invoices in batch
   */
  async submitInvoicesBatch(invoicesXml: string[]): Promise<BatchSubmissionResult> {
    const session = await this.ensureAuthenticated();
    const batchResult = await this.batchService.submitBatch(invoicesXml, session);
    
    // Convert BatchService result to expected format
    const result: BatchSubmissionResult = {
      batchReferenceNumber: batchResult.batchReferenceNumber,
      totalCount: invoicesXml.length,
      successCount: batchResult.successCount,
      failureCount: batchResult.errorCount,
      results: batchResult.invoiceResults
    };
    
    return result;
  }

  /**
   * Get UPO (proof of receipt) for an invoice
   */
  async getUpo(referenceNumber: string): Promise<UpoResponse> {
    const session = await this.ensureAuthenticated();
    return await this.invoiceService.getUpo(referenceNumber, session);
  }

  /**
   * Query invoices asynchronously
   */
  async queryInvoicesAsync(request: AsyncQueryInvoiceRequest): Promise<PagedInvoiceResponse> {
    const session = await this.ensureAuthenticated();
    return await this.invoiceService.queryInvoicesAsync(request, session);
  }

  /**
   * Grant permissions to a user
   */
  async grantPermission(
    contextIdentifier: ContextIdentifier,
    subjectIdentifier: ContextIdentifier,
    roleType: RoleType
  ): Promise<void> {
    const session = await this.ensureAuthenticated();
    return await this.permissionsService.grantPermission(
      contextIdentifier,
      subjectIdentifier,
      roleType,
      session
    );
  }

  /**
   * Revoke permissions from a user
   */
  async revokePermission(
    contextIdentifier: ContextIdentifier,
    subjectIdentifier: ContextIdentifier
  ): Promise<void> {
    const session = await this.ensureAuthenticated();
    return await this.permissionsService.revokePermission(
      contextIdentifier,
      subjectIdentifier,
      session
    );
  }

  /**
   * Query permissions for a context
   */
  async queryPermissions(
    contextIdentifier: ContextIdentifier,
    subjectIdentifier?: ContextIdentifier
  ): Promise<QueryPermissionsResponse> {
    const session = await this.ensureAuthenticated();
    return await this.permissionsService.queryPermissions(
      contextIdentifier,
      session,
      subjectIdentifier
    );
  }

  /**
   * Update client configuration
   */
  updateConfig(newConfig: Partial<KsefClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update logger debug setting if changed
    if (newConfig.debug !== undefined) {
      this.logger.updateOptions({ debug: newConfig.debug });
    }
    
    this.logger.debug('Configuration updated');
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Omit<KsefClientConfig, 'credentials'> {
    const { credentials, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Ensure client is authenticated, login if necessary
   */
  private async ensureAuthenticated(): Promise<SessionToken> {
    let session = this.authService.getCurrentSession();
    
    if (!session) {
      this.logger.debug('No active session, authenticating...');
      session = await this.login();
    }

    return session;
  }

  /**
   * Generate authentication XML for external signing
   * This creates the XML that needs to be signed by the user's certificate
   */
  async generateAuthenticationXML(): Promise<{ xml: string; challenge: string; timestamp: string }> {
    this.logger.debug('Generating authentication XML for external signing');
    return await this.authService.generateAuthenticationXML(this.config.contextIdentifier);
  }

  /**
   * Authenticate using externally signed XML
   * This accepts XML that has been signed by the user's certificate
   */
  async authenticateWithSignedXML(signedXML: string): Promise<SessionToken> {
    this.logger.debug('Authenticating with externally signed XML');
    return await this.authService.authenticateWithSignedXML(signedXML, this.config.contextIdentifier);
  }
}

/**
 * Create a new KSeF client instance
 */
export function createKsefClient(config: KsefClientConfig): KsefClient {
  return new KsefClient(config);
}

export function createExternalSigningClient(config: ExternalSigningConfig): KsefClient {
  return new KsefClient({
    ...config,
    credentials: undefined // Explicitly no credentials for external signing
  } as unknown as KsefClientConfig);
}

/**
 * Utility to create a prod environment client
 */
export function createProdClient(
  credentials: AuthCredentials,
  contextIdentifier: ContextIdentifier,
  debug = false
): KsefClient {
  return new KsefClient({
    environment: 'prod',
    credentials,
    contextIdentifier,
    debug
  });
} 

/**
 * Utility to create a test environment client
 */
export function createTestClient(
  credentials: AuthCredentials,
  contextIdentifier: ContextIdentifier,
  debug = true
): KsefClient {
  return new KsefClient({
    environment: 'test',
    credentials,
    contextIdentifier,
    debug
  });
} 

export function createProdExternalSigningClient(
  contextIdentifier: ContextIdentifier,
  debug = false
): KsefClient {
  return new KsefClient({
    environment: 'prod',
    contextIdentifier,
    debug
  });
}

export function createTestExternalSigningClient(
  contextIdentifier: ContextIdentifier,
  debug = true
): KsefClient {
  return new KsefClient({
    environment: 'test',
    contextIdentifier,
    debug
  });
} 