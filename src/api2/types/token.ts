import type { ContextIdentifier, DictionaryValueRev2, SubjectIdentifier, TokenReferenceNumber } from './common.js';

export type TokenPermissionType =
  | 'InvoiceRead'
  | 'InvoiceWrite'
  | 'CredentialsRead'
  | 'CredentialsManage'
  | 'SubunitManage'
  | 'EnforcementOperations'
  | 'Introspection'
  | 'CollectiveIdentifierManage';

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

export interface GenerateTokenRequestRev2 extends GenerateTokenRequest {
  validFrom?: string | null;
  validTo?: string | null;
}

export type TokenStatusFilterRev2 =
  | AuthenticationTokenStatus
  | 'NotYetActive'
  | 'AwaitingApproval'
  | 'ApprovalExpired'
  | 'Expired';

export type TokenAuthorIdentifierTypeFilterRev2 = 'Nip' | 'Pesel' | 'Fingerprint';

export interface TokenFailureRev2 {
  code: string;
  description: string;
  details?: string[] | null;
}

export interface TokenStatusResponseRev2 {
  referenceNumber: TokenReferenceNumber;
  authorIdentifier: {
    type: DictionaryValueRev2<TokenAuthorIdentifierTypeFilterRev2 | 'FutureValue'>;
    value: string;
  };
  contextIdentifier: {
    type: DictionaryValueRev2<'Nip' | 'InternalId' | 'NipVatUe' | 'PeppolId' | 'FutureValue'>;
    value: string;
  };
  description: string;
  requestedPermissions: DictionaryValueRev2<TokenPermissionType | 'FutureValue'>[];
  dateCreated: string;
  lastUseDate?: string | null;
  validFrom: string;
  validTo: string;
  status: DictionaryValueRev2<TokenStatusFilterRev2 | 'FutureValue'>;
  failure?: TokenFailureRev2 | null;
}

export interface QueryTokensResponseRev2 {
  continuationToken?: string | null;
  tokens: TokenStatusResponseRev2[];
}
