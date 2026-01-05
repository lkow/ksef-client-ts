import type {
  ContextIdentifier,
  SubjectIdentifier,
  EntityIdentifier,
  Nip
} from './common.js';

export interface TestDataPermission {
  permissionType: string;
  description?: string;
}

export interface TestDataPermissionsGrantRequest {
  contextIdentifier: ContextIdentifier;
  authorizedIdentifier: ContextIdentifier | SubjectIdentifier;
  permissions: TestDataPermission[];
}

export interface TestDataPermissionsRevokeRequest {
  contextIdentifier: ContextIdentifier;
  authorizedIdentifier: ContextIdentifier | SubjectIdentifier;
}

export interface AttachmentPermissionGrantRequest {
  nip: Nip;
}

export interface AttachmentPermissionRevokeRequest {
  nip: Nip;
  expectedEndDate?: string;
}

export type SubjectType =
  | 'EnforcementAuthority'
  | 'LocalGovernmentUnit'
  | 'VatGroup'
  | 'VatGroupUnit'
  | 'Business';

export interface SubjectCreateRequest {
  subjectNip: Nip;
  subjectType: SubjectType;
  description: string;
  createdDate?: string;
  subunits?: { subjectNip: Nip; description?: string }[];
}

export interface SubjectRemoveRequest {
  subjectNip: Nip;
}

export interface PersonCreateRequest {
  nip: Nip;
  pesel: string;
  isBailiff: boolean;
  description: string;
  isDeceased?: boolean;
  createdDate?: string;
}

export interface PersonRemoveRequest {
  nip: Nip;
}

export interface SessionLimitOverride {
  maxInvoiceSizeInMB?: number;
  maxInvoiceWithAttachmentSizeInMB?: number;
  maxInvoices?: number;
}

export interface SetSessionLimitsRequest {
  onlineSession: SessionLimitOverride;
  batchSession: SessionLimitOverride;
}

export interface SetSubjectLimitsRequest {
  certificate?: { maxCertificates?: number };
  enrollment?: { maxEnrollments?: number };
  subjectIdentifierType?: 'Nip' | 'Pesel';
}

export interface SetRateLimitsRequest {
  rateLimits: Record<
    string,
    {
      perSecond?: number;
      perMinute?: number;
      perHour?: number;
    }
  >;
}
