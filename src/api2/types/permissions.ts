import type { ContextIdentifier, SubjectIdentifier, EntityIdentifier } from './common.js';
import type { ApiV2ResponseStatus } from './common.js';

export type PermissionType =
  | 'InvoiceRead'
  | 'InvoiceWrite'
  | 'CredentialsManage'
  | 'CredentialsRead'
  | 'Introspection'
  | 'SubunitManage'
  | 'EnforcementOperations'
  | 'VatUeManage';

export interface EntityDetails {
  fullName: string;
}

export interface IdDocument {
  type: string;
  number: string;
  country: string;
}

export type PersonIdentifierType = 'Pesel' | 'Nip';

export interface PersonIdentifier {
  type: PersonIdentifierType;
  value: string;
}

export interface PersonDetails {
  firstName: string;
  lastName: string;
}

export interface PersonByFingerprintWithIdentifierDetails extends PersonDetails {
  identifier: PersonIdentifier;
}

export interface PersonByFingerprintWithoutIdentifierDetails extends PersonDetails {
  birthDate: string;
  idDocument: IdDocument;
}

export type PersonPermissionSubjectDetailsType =
  | 'PersonByIdentifier'
  | 'PersonByFingerprintWithIdentifier'
  | 'PersonByFingerprintWithoutIdentifier';

export interface PersonPermissionSubjectDetails {
  subjectDetailsType: PersonPermissionSubjectDetailsType;
  personById?: PersonDetails | null;
  personByFpWithId?: PersonByFingerprintWithIdentifierDetails | null;
  personByFpNoId?: PersonByFingerprintWithoutIdentifierDetails | null;
}

export interface EntityByFingerprintDetails {
  fullName: string;
  address: string;
}

export type EuEntityPermissionSubjectDetailsType =
  | 'PersonByFingerprintWithIdentifier'
  | 'PersonByFingerprintWithoutIdentifier'
  | 'EntityByFingerprint';

export interface EuEntityPermissionSubjectDetails {
  subjectDetailsType: EuEntityPermissionSubjectDetailsType;
  personByFpWithId?: PersonByFingerprintWithIdentifierDetails | null;
  personByFpNoId?: PersonByFingerprintWithoutIdentifierDetails | null;
  entityByFp?: EntityByFingerprintDetails | null;
}

export interface EuEntityDetails {
  fullName: string;
  address: string;
}

export interface PermissionsOperationResponse {
  referenceNumber: string;
}

export interface PersonPermissionsGrantRequest {
  subjectIdentifier: SubjectIdentifier;
  permissions: PermissionType[];
  description: string;
  subjectDetails: PersonPermissionSubjectDetails;
}

export interface EntityPermission {
  type: Extract<PermissionType, 'InvoiceRead' | 'InvoiceWrite'>;
  canDelegate?: boolean;
}

export interface EntityPermissionsGrantRequest {
  subjectIdentifier: EntityIdentifier;
  permissions: EntityPermission[];
  description: string;
  subjectDetails: EntityDetails;
}

export interface AttachmentStatusRequest {
  nip: string;
}

export interface CheckAttachmentPermissionStatusResponse {
  isAttachmentAllowed: boolean;
  revokedDate?: string | null;
}

// Legacy alias for backward compatibility
export interface AttachmentStatusResponse {
  status: ApiV2ResponseStatus;
  isAttachmentAllowed: boolean;
}

export interface AttachmentStatus {
  isAttachmentAllowed: boolean;
}

export interface IndirectPermissionsGrantRequest {
  subjectIdentifier: SubjectIdentifier;
  targetIdentifier?: IndirectTargetIdentifier;
  permissions: Extract<PermissionType, 'InvoiceRead' | 'InvoiceWrite'>[];
  description: string;
  subjectDetails: PersonPermissionSubjectDetails;
}

export type IndirectTargetIdentifierType = 'Nip' | 'InternalId' | 'AllPartners';

export interface IndirectTargetIdentifier {
  type: IndirectTargetIdentifierType;
  value?: string | null;
}

export interface SubunitPermissionsGrantRequest {
  subjectIdentifier: SubjectIdentifier;
  contextIdentifier: ContextIdentifier;
  description: string;
  subunitName?: string;
  subjectDetails: PersonPermissionSubjectDetails;
}

export interface EuEntityAdministrationPermissionsGrantRequest {
  subjectIdentifier: SubjectIdentifier;
  contextIdentifier: ContextIdentifier;
  description: string;
  euEntityName: string;
  subjectDetails: EuEntityPermissionSubjectDetails;
  euEntityDetails: EuEntityDetails;
}

export interface EuEntityPermissionsGrantRequest {
  subjectIdentifier: SubjectIdentifier;
  permissions: Extract<PermissionType, 'InvoiceRead' | 'InvoiceWrite'>[];
  description: string;
  subjectDetails: EuEntityPermissionSubjectDetails;
}

export interface PermissionsOperationStatusResponse {
  status: ApiV2ResponseStatus;
  referenceNumber?: string;
}

export type PermissionState = 'Active' | 'Inactive';

export type EuEntityPermissionType = 'VatUeManage' | 'InvoiceWrite' | 'InvoiceRead' | 'Introspection';

export interface PersonalPermissionsQueryRequest {
  contextIdentifier?: ContextIdentifier;
  targetIdentifier?: ContextIdentifier;
  permissionTypes?: PermissionType[];
  permissionState?: PermissionState;
}

export interface PersonPermissionsQueryRequest {
  queryType: string;
  authorIdentifier?: SubjectIdentifier;
  permissionTypes?: PermissionType[];
  permissionState?: PermissionState;
}

export interface SubunitPermissionsQueryRequest {
  subunitIdentifier?: ContextIdentifier;
}

export interface QueryPermissionsResponse<T> {
  permissions: T[];
  hasMore: boolean;
}

export type EntityAuthorizationPermissionType = 'SelfInvoicing' | 'TaxRepresentative' | 'RRInvoicing' | 'PefInvoicing';

export type QueryType = 'Granted' | 'Received';

export interface EntityAuthorizationsAuthorizingEntityIdentifier {
  type: 'Nip';
  value: string;
}

export interface EntityAuthorizationsAuthorizedEntityIdentifier {
  type: 'Nip' | 'PeppolId';
  value: string;
}

export interface EntityAuthorizationPermissionsQueryRequest {
  queryType: QueryType;
  authorizingIdentifier?: EntityAuthorizationsAuthorizingEntityIdentifier | null;
  authorizedIdentifier?: EntityAuthorizationsAuthorizedEntityIdentifier | null;
  permissionTypes?: EntityAuthorizationPermissionType[] | null;
}

export interface EntityAuthorizationGrant {
  id: string;
  authorIdentifier?: SubjectIdentifier | null;
  authorizedEntityIdentifier: EntityAuthorizationsAuthorizedEntityIdentifier;
  authorizingEntityIdentifier: EntityAuthorizationsAuthorizingEntityIdentifier;
  authorizationScope: EntityAuthorizationPermissionType;
  description: string;
  startDate: string;
  subjectEntityDetails?: EntityDetails | null;
}

export interface QueryEntityAuthorizationPermissionsResponse {
  authorizationGrants: EntityAuthorizationGrant[];
  hasMore: boolean;
}
