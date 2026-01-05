import type { ApiV2ResponseStatus } from './common.js';

export interface AuthenticationListItem {
  referenceNumber: string;
  startDate: string;
  authenticationMethod: string;
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
