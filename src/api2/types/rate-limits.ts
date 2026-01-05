export interface EffectiveApiRateLimitValues {
  perSecond: number;
  perMinute: number;
  perHour: number;
}

export interface EffectiveApiRateLimits {
  onlineSession: EffectiveApiRateLimitValues;
  batchSession: EffectiveApiRateLimitValues;
  invoiceSend: EffectiveApiRateLimitValues;
  invoiceStatus: EffectiveApiRateLimitValues;
  sessionList: EffectiveApiRateLimitValues;
  sessionInvoiceList: EffectiveApiRateLimitValues;
  sessionMisc: EffectiveApiRateLimitValues;
  invoiceMetadata: EffectiveApiRateLimitValues;
  invoiceExport: EffectiveApiRateLimitValues;
  invoiceExportStatus: EffectiveApiRateLimitValues;
  invoiceDownload: EffectiveApiRateLimitValues;
  other: EffectiveApiRateLimitValues;
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
