/**
 * Authentication and session related types
 */



import type { StatusInfo, ContextIdentifier, IpAddressPolicy } from './common.js';

export interface AuthorisationChallengeRequest {
  contextIdentifier: ContextIdentifier;
  timestamp: string;
}

export interface AuthorisationChallengeResponse {
  challenge: string;
  timestamp: string;
}

export interface InitSignedRequest {
  challenge: string;
  contextIdentifier: ContextIdentifier;
  signature: string;
  timestamp: string;
}

export interface InitTokenRequest {
  challenge: string;
  contextIdentifier: ContextIdentifier;
  encryptedToken: string;
  ipAddressPolicy?: IpAddressPolicy;
}

export interface SessionResponse {
  sessionToken: SessionToken;
  referenceNumber: string;
  status?: StatusInfo;
}

export interface SessionToken {
  token: string;
  context: SessionContext;
}

export interface SessionContext {
  contextIdentifier: ContextIdentifier;
  contextName?: string;
  credentialsRoleList: string[];
}

export interface SessionStatusResponse {
  referenceNumber: string;
  processingCode: number;
  processingDescription: string;
  timestamp: string;
  sessionStatus?: SessionStatus;
}

export interface SessionStatus {
  isActive: boolean;
  expirationTimestamp?: string;
}

export interface TokenInfo {
  token: string;
  description?: string;
  elementReferenceNumber?: string;
  timestamp?: string;
}

export interface GenerateTokenRequest {
  description?: string;
}

export interface GenerateTokenResponse {
  elementReferenceNumber: string;
  status: StatusInfo;
  token?: string;
}

export interface RevokeTokenRequest {
  tokenNumber: string;
}

export interface QueryTokensRequest {
  contextIdentifier: ContextIdentifier;
  includeDetails?: boolean;
}

export interface QueryTokensResponse {
  tokenList: TokenInfo[];
  status?: StatusInfo;
}

export interface CertificateCredentials {
  /** Path to certificate file or certificate data as Buffer/string */
  certificate: string | Buffer;
  /** Certificate password if required */
  password?: string;
  /** Private key if separate from certificate */
  privateKey?: string | Buffer;
  /** Private key password if required */
  privateKeyPassword?: string;
}

export interface TokenCredentials {
  /** Pre-generated authentication token */
  token: string;
}

export type AuthCredentials = CertificateCredentials | TokenCredentials;

export function isCertificateCredentials(credentials: AuthCredentials): credentials is CertificateCredentials {
  return 'certificate' in credentials;
}

export function isTokenCredentials(credentials: AuthCredentials): credentials is TokenCredentials {
  return 'token' in credentials;
} 