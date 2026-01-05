import type { ApiV2ResponseStatus } from './common.js';

export type KsefCertificateType = 'Authentication' | 'Offline';

export type CertificateListItemStatus = 'Active' | 'Blocked' | 'Revoked' | 'Expired';

export type CertificateRevocationReason = 'Unspecified' | 'Superseded' | 'KeyCompromise';

export type CertificateSubjectIdentifierType = 'Nip' | 'Pesel' | 'Fingerprint';

export interface CertificateSubjectIdentifier {
  type: CertificateSubjectIdentifierType;
  value: string;
}

export interface CertificateLimit {
  limit: number;
  remaining: number;
}

export interface CertificateLimitsResponse {
  canRequest: boolean;
  enrollment: CertificateLimit;
  certificate: CertificateLimit;
}

export interface CertificateEnrollmentDataResponse {
  commonName: string;
  countryName: string;
  givenName?: string | null;
  surname?: string | null;
  serialNumber?: string | null;
  uniqueIdentifier?: string | null;
  organizationName?: string | null;
  organizationIdentifier?: string | null;
}

export interface EnrollCertificateRequest {
  certificateName: string;
  certificateType: KsefCertificateType;
  csr: string;
  validFrom?: string | null;
}

export interface EnrollCertificateResponse {
  referenceNumber: string;
  timestamp: string;
}

export interface CertificateEnrollmentStatusResponse {
  requestDate: string;
  status: ApiV2ResponseStatus;
  certificateSerialNumber?: string | null;
}

export interface RetrieveCertificatesRequest {
  certificateSerialNumbers: string[];
}

export interface RetrieveCertificatesListItem {
  certificate: string;
  certificateName: string;
  certificateSerialNumber: string;
  certificateType: KsefCertificateType;
}

export interface RetrieveCertificatesResponse {
  certificates: RetrieveCertificatesListItem[];
}

export interface RevokeCertificateRequest {
  revocationReason?: CertificateRevocationReason | null;
}

export interface CertificateListItem {
  certificateSerialNumber: string;
  name: string;
  type: KsefCertificateType;
  commonName: string;
  status: CertificateListItemStatus;
  subjectIdentifier: CertificateSubjectIdentifier;
  validFrom: string;
  validTo: string;
  requestDate: string;
  lastUseDate?: string | null;
}

export interface QueryCertificatesRequest {
  certificateSerialNumber?: string | null;
  name?: string | null;
  type?: KsefCertificateType | null;
  status?: CertificateListItemStatus | null;
  subjectIdentifier?: CertificateSubjectIdentifier | null;
  validFrom?: string | null;
  validTo?: string | null;
}

export interface QueryCertificatesResponse {
  certificates: CertificateListItem[];
  hasMore: boolean;
}

