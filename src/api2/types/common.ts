/**
 * Common API v2 types shared across services.
 *
 * References:
 * - https://github.com/CIRFMF/ksef-docs/blob/main/przeglad-kluczowych-zmian-ksef-api-2-0.md
 * - https://api-test.ksef.mf.gov.pl/docs/v2/openapi.json (components Context identifiers + ReferenceNumber schema)
 */

export const API_V2_BASE_URLS = {
  test: 'https://api-test.ksef.mf.gov.pl/v2',
  demo: 'https://api-demo.ksef.mf.gov.pl/v2',
  prod: 'https://api.ksef.mf.gov.pl/v2'
} as const;

export type ApiV2Environment = keyof typeof API_V2_BASE_URLS;

export enum ContextIdentifierType {
  NIP = 'Nip',
  INTERNAL_ID = 'InternalId',
  NIP_VAT_UE = 'NipVatUe',
  PEPPOL_ID = 'PeppolId'
}

export interface ContextIdentifier {
  type: ContextIdentifierType;
  value: string;
}

export type Nip = string;

export enum SubjectIdentifierType {
  NIP = 'Nip',
  PESEL = 'Pesel',
  FINGERPRINT = 'Fingerprint'
}

export interface SubjectIdentifier {
  type: SubjectIdentifierType;
  value: string;
}

export enum EntityIdentifierType {
  NIP = 'Nip',
  INTERNAL_ID = 'InternalId',
  NIP_VAT_UE = 'NipVatUe',
  PEPPOL_ID = 'PeppolId'
}

export interface EntityIdentifier {
  type: EntityIdentifierType;
  value: string;
}

export interface ApiV2ResponseStatus {
  code: number;
  description: string;
  details?: string[];
  extensions?: Record<string, string>;
}

export interface ReferenceNumberResponse {
  referenceNumber: string;
}

export interface AuthenticationTokens {
  token: string;
  validUntil: string;
}

export interface AuthenticationTokensResponse {
  accessToken: AuthenticationTokens;
  refreshToken: AuthenticationTokens;
}

export interface AuthenticationChallengeResponse {
  challenge: string;
  timestamp: string;
  timestampMs: number;
}

export interface AuthenticationInitResponse {
  referenceNumber: string;
  authenticationToken: AuthenticationTokens;
}

export interface AuthenticationOperationStatusResponse {
  startDate: string;
  authenticationMethod: 'Token' | 'QualifiedSeal' | 'QualifiedSignature' | string;
  status: ApiV2ResponseStatus;
}

export interface AuthenticationTokenRedeemResponse {
  accessToken: AuthenticationTokens;
  refreshToken: AuthenticationTokens;
}

export interface AuthenticationTokenRefreshResponse {
  accessToken: AuthenticationTokens;
}

export interface PaginatedResponse<TItem> {
  items: TItem[];
  continuationToken?: string;
}

export type Sha256HashBase64 = string;
export type TokenReferenceNumber = string;

export interface FormCode {
  systemCode: string;
  schemaVersion: string;
  value: string;
}

export type UpoVersion = 'upo-v4-2' | 'upo-v4-3';

export interface EncryptionInfo {
  encryptedSymmetricKey: string;
  initializationVector: string;
}

export interface OpenOnlineSessionRequest {
  formCode: FormCode;
  encryption: EncryptionInfo;
}

export interface OpenOnlineSessionResponse {
  referenceNumber: string;
  validUntil: string;
}

export interface BatchFilePartInfo {
  ordinalNumber: number;
  fileSize: number;
  fileHash: string;
}

export interface BatchFileInfo {
  fileSize: number;
  fileHash: string;
  fileParts: BatchFilePartInfo[];
}

export interface PartUploadRequest {
  ordinalNumber: number;
  method: 'PUT' | 'POST';
  url: string;
  headers: Record<string, string>;
}

export interface OpenBatchSessionRequest {
  formCode: FormCode;
  batchFile: BatchFileInfo;
  encryption: EncryptionInfo;
  offlineMode?: boolean;
}

export interface OpenBatchSessionResponse {
  referenceNumber: string;
  partUploadRequests: PartUploadRequest[];
}
