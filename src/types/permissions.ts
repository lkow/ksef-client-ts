/**
 * Permissions management types
 */

import type { StatusInfo, ContextIdentifier } from './common.js';

export interface GrantPermissionsRequest {
  contextIdentifier: ContextIdentifier;
  subjectIdentifier: ContextIdentifier;
  roleType: RoleType;
}

export interface GrantPermissionsResponse {
  elementReferenceNumber: string;
  status: StatusInfo;
}

export interface RevokePermissionsRequest {
  contextIdentifier: ContextIdentifier;
  subjectIdentifier: ContextIdentifier;
}

export interface RevokePermissionsResponse {
  elementReferenceNumber: string;
  status: StatusInfo;
}

export interface QueryPermissionsRequest {
  contextIdentifier: ContextIdentifier;
  subjectIdentifier?: ContextIdentifier;
}

export interface QueryPermissionsResponse {
  permissions: PermissionInfo[];
  status?: StatusInfo;
}

export interface PermissionInfo {
  contextIdentifier: ContextIdentifier;
  subjectIdentifier: ContextIdentifier;
  roleType: RoleType;
  grantedTimestamp: string;
  status: PermissionStatus;
}

export enum RoleType {
  INVOICE_WRITE = 'invoice_write',
  INVOICE_READ = 'invoice_read',
  SELF_INVOICING = 'self_invoicing',
  PAYMENT_CONFIRMATION = 'payment_confirmation',
  TAX_REPRESENTATIVE = 'tax_representative'
}

export enum PermissionStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  PENDING = 'PENDING'
}

export interface PermissionStatusResponse {
  referenceNumber: string;
  processingCode: number;
  processingDescription: string;
  timestamp: string;
  permissionStatus?: PermissionStatus;
}

// EU Entity specific permissions
export interface EuEntityPermissionsQueryRequest {
  authorisationContextIdentifier: ContextIdentifier;
  contextIdentifier: ContextIdentifier;
}

export interface EuEntityGrantPermissionsRequest {
  authorisationContextIdentifier: ContextIdentifier;
  contextIdentifier: ContextIdentifier;
  subjectIdentifier: ContextIdentifier;
  roleType: RoleType;
}

export interface EuEntityRevokePermissionsRequest {
  authorisationContextIdentifier: ContextIdentifier;
  contextIdentifier: ContextIdentifier;
  subjectIdentifier: ContextIdentifier;
}

// EU Entity Representative permissions
export interface EuEntityRepresentativeGrantPermissionsRequest {
  authorisationContextIdentifier: ContextIdentifier;
  contextIdentifier: ContextIdentifier;
  subjectIdentifier: ContextIdentifier;
  roleType: RoleType;
}

export interface EuEntityRepresentativeRevokePermissionsRequest {
  authorisationContextIdentifier: ContextIdentifier;
  contextIdentifier: ContextIdentifier;
  subjectIdentifier: ContextIdentifier;
}

// Sub Unit permissions
export interface SubUnitPermissionsQueryRequest {
  authorisationContextIdentifier: ContextIdentifier;
  contextIdentifier: ContextIdentifier;
}

export interface SubUnitGrantPermissionsRequest {
  authorisationContextIdentifier: ContextIdentifier;
  contextIdentifier: ContextIdentifier;
  subjectIdentifier: ContextIdentifier;
  roleType: RoleType;
}

export interface SubUnitRevokePermissionsRequest {
  authorisationContextIdentifier: ContextIdentifier;
  contextIdentifier: ContextIdentifier;
  subjectIdentifier: ContextIdentifier;
}

// Indirect permissions
export interface IndirectPermissionsRequest {
  subjectIdentifier: ContextIdentifier;
  contextIdentifier: ContextIdentifier;
}

export interface IndirectPermissionsResponse {
  elementReferenceNumber: string;
  status: StatusInfo;
}

// Proxy permissions
export interface ProxyPermissionsRequest {
  contextIdentifier: ContextIdentifier;
  subjectIdentifier: ContextIdentifier;
  roleType: RoleType;
}

export interface ProxyPermissionsResponse {
  elementReferenceNumber: string;
  status: StatusInfo;
} 