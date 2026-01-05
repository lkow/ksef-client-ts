import type { ContextIdentifier, SubjectIdentifier, TokenReferenceNumber } from './common.js';

export type TokenPermissionType =
  | 'InvoiceRead'
  | 'InvoiceWrite'
  | 'CredentialsRead'
  | 'CredentialsManage'
  | 'SubunitManage'
  | 'EnforcementOperations';

export type AuthenticationTokenStatus = 'Pending' | 'Active' | 'Revoking' | 'Revoked' | 'Failed';

export interface GenerateTokenRequest {
  permissions: TokenPermissionType[];
  description: string;
}

export interface GenerateTokenResponse {
  referenceNumber: TokenReferenceNumber;
  token: string;
}

export interface TokenListItem {
  referenceNumber: TokenReferenceNumber;
  authorIdentifier: SubjectIdentifier;
  contextIdentifier: ContextIdentifier;
  description?: string | null;
  requestedPermissions: TokenPermissionType[];
  dateCreated: string;
  status: AuthenticationTokenStatus;
  statusDetails?: string[];
  lastUseDate?: string | null;
}

export interface QueryTokensResponse {
  continuationToken?: string | null;
  tokens: TokenListItem[];
}

export interface TokenStatusResponse {
  referenceNumber: TokenReferenceNumber;
  authorIdentifier: SubjectIdentifier;
  contextIdentifier: ContextIdentifier;
  description?: string | null;
  requestedPermissions: TokenPermissionType[];
  status: AuthenticationTokenStatus;
  dateCreated: string;
  lastUseDate?: string | null;
  statusDetails?: string[];
}
