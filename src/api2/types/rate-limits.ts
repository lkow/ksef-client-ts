/** The API uses -1 for a disabled limit window. */
export interface EffectiveApiRateLimitValues {
  perSecond: number;
  perMinute: number;
  perHour: number;
}

export interface EffectiveApiRateLimits {
  onlineSession: EffectiveApiRateLimitValues;
  /** API 2.8.0; absent on older environments. */
  onlineSessionClose?: EffectiveApiRateLimitValues;
  batchSession: EffectiveApiRateLimitValues;
  /** API 2.8.0; absent on older environments. */
  batchSessionClose?: EffectiveApiRateLimitValues;
  invoiceSend: EffectiveApiRateLimitValues;
  invoiceStatus: EffectiveApiRateLimitValues;
  sessionList: EffectiveApiRateLimitValues;
  sessionInvoiceList: EffectiveApiRateLimitValues;
  sessionMisc: EffectiveApiRateLimitValues;
  invoiceMetadata: EffectiveApiRateLimitValues;
  invoiceExport: EffectiveApiRateLimitValues;
  invoiceExportStatus: EffectiveApiRateLimitValues;
  invoiceDownload: EffectiveApiRateLimitValues;
  /** Absent on environments without collective identifier support. */
  collectiveIdentifier?: EffectiveApiRateLimitValues;
  other: EffectiveApiRateLimitValues;
  /** API 2.8.0; absent on older environments. */
  anonymous?: EffectiveApiRateLimitValues;
  /** API 2.8.0, per IP. Exposed separately, not applied as an endpoint category. */
  global?: EffectiveApiRateLimitValues;
}

export type RateLimitCategory = keyof EffectiveApiRateLimits;

export interface EffectiveSessionLimits {
  maxInvoiceSizeInMB: number;
  maxInvoiceWithAttachmentSizeInMB: number;
  maxInvoices: number;
}

export interface EffectiveContextLimits {
  onlineSession: EffectiveSessionLimits;
  batchSession: EffectiveSessionLimits;
  /** API 2.7.1; absent on older environments. */
  collectiveIdentifier?: CollectiveIdentifierEffectiveContextLimits;
}

export interface CollectiveIdentifierEffectiveContextLimits {
  maxInvoices: number;
}

export interface EnrollmentEffectiveSubjectLimits {
  maxEnrollments?: number;
}

export interface CertificateEffectiveSubjectLimits {
  maxCertificates?: number;
}

export interface EffectiveSubjectLimits {
  enrollment?: EnrollmentEffectiveSubjectLimits | null;
  certificate?: CertificateEffectiveSubjectLimits | null;
}
