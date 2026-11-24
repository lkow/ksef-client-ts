import type {
  ApiV2ResponseStatus,
  AuthenticationMethodInfo,
  AuthenticationOperationStatusResponseRev2
} from './common.js';

export interface AuthenticationListItem {
  referenceNumber: string;
  startDate: string;
  authenticationMethod: string;
  authenticationMethodInfo?: AuthenticationMethodInfo;
  status: ApiV2ResponseStatus;
  isTokenRedeemed?: boolean | null;
  lastTokenRefreshDate?: string | null;
  refreshTokenValidUntil?: string | null;
  isCurrent?: boolean;
}

export interface AuthenticationListResponse {
  continuationToken?: string | null;
  items: AuthenticationListItem[];
}

export interface AuthenticationListItemRev2 extends AuthenticationOperationStatusResponseRev2 {
  referenceNumber: string;
  isCurrent?: boolean;
}

export interface AuthenticationListResponseRev2 {
  continuationToken?: string | null;
  items: AuthenticationListItemRev2[];
}
