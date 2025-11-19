/**
 * Offline invoice mode types for KSeF
 * Based on:
 * - https://github.com/CIRFMF/ksef-docs/blob/main/tryby-offline.md
 * - https://github.com/CIRFMF/ksef-docs/blob/main/certyfikaty-KSeF.md
 */

import type { ContextIdentifier } from './common.js';
import type { InvoiceQRCodes, OfflineCertificate } from './qr-code.js';

/**
 * Input data for generating offline invoices
 * Contains all necessary metadata that cannot be easily extracted from XML
 */
export interface OfflineInvoiceInputData {
  /** Invoice number (e.g., "FV/2025/001") */
  invoiceNumber: string;
  
  /** Invoice issue date (ISO 8601 format) */
  invoiceDate: string;
  
  /** Seller/issuer identifier */
  sellerIdentifier: ContextIdentifier;
  
  /** Buyer identifier (optional) */
  buyerIdentifier?: ContextIdentifier;
  
  /** Total invoice amount (gross) */
  totalAmount: number;
  
  /** Currency code (e.g., "PLN", "EUR") */
  currency: string;
}

/**
 * Offline invoice modes per tryby-offline.md
 * 
 * - offline24: Planned offline invoice (must submit within 24h)
 * - offline: Unplanned offline due to system unavailability
 * - awaryjny: Emergency mode during system failures
 * - awaria_calkowita: Total system failure mode
 */
export type OfflineMode = 'offline24' | 'offline' | 'awaryjny' | 'awaria_calkowita';

/**
 * Reason for offline invoice generation
 * Helps distinguish between planned and unplanned offline scenarios
 */
export enum OfflineReason {
  /** Planned offline to avoid API limits or for business reasons */
  PLANNED = 'PLANNED',
  
  /** System unavailability (detected maintenance window) */
  SYSTEM_UNAVAILABLE = 'SYSTEM_UNAVAILABLE',
  
  /** Emergency mode during unexpected failures */
  EMERGENCY = 'EMERGENCY',
  
  /** Total system failure */
  TOTAL_FAILURE = 'TOTAL_FAILURE'
}

/**
 * Maintenance window information
 * Used to track system unavailability periods and extend deadlines
 */
export interface MaintenanceWindow {
  /** Maintenance window ID (from external storage/API) */
  id: string;
  
  /** Start of maintenance window */
  startTime: string;
  
  /** End of maintenance window (may be estimated or null if unknown) */
  endTime?: string;
  
  /** Whether the window is currently active */
  active: boolean;
  
  /** Reason/description for maintenance */
  reason?: string;
  
  /** Whether this is planned or unplanned maintenance */
  planned: boolean;
}

/**
 * Offline invoice status
 */
export enum OfflineInvoiceStatus {
  /** Invoice generated offline, not yet submitted */
  GENERATED = 'GENERATED',
  
  /** Invoice queued for submission */
  QUEUED = 'QUEUED',
  
  /** Invoice submitted to KSeF */
  SUBMITTED = 'SUBMITTED',
  
  /** Invoice accepted by KSeF */
  ACCEPTED = 'ACCEPTED',
  
  /** Invoice rejected by KSeF */
  REJECTED = 'REJECTED',
  
  /** Submission expired (missed time window) */
  EXPIRED = 'EXPIRED'
}

/**
 * Offline invoice metadata
 */
export interface OfflineInvoiceMetadata {
  /** Unique identifier for tracking */
  id: string;
  
  /** Offline mode used */
  mode: OfflineMode;
  
  /** Reason for offline generation */
  reason: OfflineReason;
  
  /** Invoice number */
  invoiceNumber: string;
  
  /** Invoice XML content */
  invoiceXml: string;
  
  /** Seller identifier */
  sellerIdentifier: ContextIdentifier;
  
  /** Buyer identifier */
  buyerIdentifier?: ContextIdentifier;
  
  /** QR codes for the invoice (KOD I + optional KOD II) */
  qrCodes: InvoiceQRCodes;
  
  /** Generation timestamp */
  generatedAt: string;
  
  /** Deadline for submission (ISO 8601) */
  submitBy: string;
  
  /** 
   * Maintenance window reference (if generated during system unavailability)
   * Used to extend deadlines when system comes back online
   */
  maintenanceWindowId?: string;
  
  /** Current status */
  status: OfflineInvoiceStatus;
  
  /** KSeF reference number (after successful submission) */
  ksefReferenceNumber?: string;
  
  /** Submission timestamp */
  submittedAt?: string;
  
  /** Error details if rejected */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Offline invoice generation options
 */
export interface OfflineInvoiceOptions {
  /** Offline mode to use (default: 'offline24') */
  mode?: OfflineMode;
  
  /** 
   * Reason for offline generation (default: PLANNED for offline24, SYSTEM_UNAVAILABLE for others)
   */
  reason?: OfflineReason;
  
  /** 
   * Maintenance window ID (for system unavailability scenarios)
   * Reference to external storage/API tracking maintenance windows
   */
  maintenanceWindowId?: string;
  
  /** 
   * Offline certificate for KOD II generation (required per certyfikaty-KSeF.md)
   * Must be certificate type "Offline", NOT "Authentication"
   */
  offlineCertificate?: OfflineCertificate;
  
  /** Generate QR codes automatically (default: true) */
  generateQRCodes?: boolean;
  
  /** QR code options */
  qrCodeOptions?: {
    format?: 'png' | 'svg' | 'dataurl';
    width?: number;
  };
  
  /** 
   * Override deadline calculation
   * Useful when maintenance window extends submission time
   */
  customDeadline?: Date | string;
  
  /** Save to file path (optional) */
  savePath?: string;
}

/**
 * Offline invoice batch submission options
 */
export interface OfflineInvoiceBatchOptions {
  /** Maximum batch size (default: 100) */
  batchSize?: number;
  
  /** Filter by status */
  statusFilter?: OfflineInvoiceStatus[];
  
  /** Submit only invoices expiring within X hours */
  expiringWithinHours?: number;
  
  /** Continue on error (default: true) */
  continueOnError?: boolean;
}

/**
 * Offline invoice batch result
 */
export interface OfflineInvoiceBatchResult {
  /** Total invoices processed */
  total: number;
  
  /** Successfully submitted */
  submitted: number;
  
  /** Accepted by KSeF */
  accepted: number;
  
  /** Rejected by KSeF */
  rejected: number;
  
  /** Failed to submit */
  failed: number;
  
  /** Expired (missed deadline) */
  expired: number;
  
  /** Individual results */
  results: OfflineInvoiceSubmissionResult[];
}

/**
 * Single offline invoice submission result
 */
export interface OfflineInvoiceSubmissionResult {
  /** Invoice ID */
  id: string;
  
  /** Invoice number */
  invoiceNumber: string;
  
  /** Submission success */
  success: boolean;
  
  /** KSeF reference number if successful */
  ksefReferenceNumber?: string;
  
  /** Error if failed */
  error?: {
    code: string;
    message: string;
  };
  
  /** Submission timestamp */
  timestamp: string;
}

/**
 * Offline invoice storage interface
 * Implement this to persist offline invoices
 */
export interface OfflineInvoiceStorage {
  /** Save offline invoice */
  save(invoice: OfflineInvoiceMetadata): Promise<void>;
  
  /** Get offline invoice by ID */
  get(id: string): Promise<OfflineInvoiceMetadata | null>;
  
  /** List offline invoices */
  list(filter?: {
    status?: OfflineInvoiceStatus[];
    mode?: OfflineMode;
    expiringBefore?: string;
  }): Promise<OfflineInvoiceMetadata[]>;
  
  /** Update offline invoice */
  update(id: string, updates: Partial<OfflineInvoiceMetadata>): Promise<void>;
  
  /** Delete offline invoice */
  delete(id: string): Promise<void>;
}

/**
 * In-memory storage implementation (for testing/simple use cases)
 */
export class InMemoryOfflineInvoiceStorage implements OfflineInvoiceStorage {
  private invoices: Map<string, OfflineInvoiceMetadata> = new Map();

  async save(invoice: OfflineInvoiceMetadata): Promise<void> {
    this.invoices.set(invoice.id, invoice);
  }

  async get(id: string): Promise<OfflineInvoiceMetadata | null> {
    return this.invoices.get(id) || null;
  }

  async list(filter?: {
    status?: OfflineInvoiceStatus[];
    mode?: OfflineMode;
    expiringBefore?: string;
  }): Promise<OfflineInvoiceMetadata[]> {
    let results = Array.from(this.invoices.values());

    if (filter) {
      if (filter.status) {
        results = results.filter(inv => filter.status!.includes(inv.status));
      }
      if (filter.mode) {
        results = results.filter(inv => inv.mode === filter.mode);
      }
      if (filter.expiringBefore) {
        const expiryDate = new Date(filter.expiringBefore);
        results = results.filter(inv => new Date(inv.submitBy) <= expiryDate);
      }
    }

    return results;
  }

  async update(id: string, updates: Partial<OfflineInvoiceMetadata>): Promise<void> {
    const invoice = this.invoices.get(id);
    if (invoice) {
      this.invoices.set(id, { ...invoice, ...updates });
    }
  }

  async delete(id: string): Promise<void> {
    this.invoices.delete(id);
  }

  /**
   * Clear all invoices (for testing)
   */
  async clear(): Promise<void> {
    this.invoices.clear();
  }

  /**
   * Get count of stored invoices
   */
  getCount(): number {
    return this.invoices.size;
  }
}

/**
 * Calculate submission deadline for offline invoice
 * 
 * @param mode Offline mode
 * @param generatedAt Invoice generation time (default: now)
 * @param maintenanceWindow Optional maintenance window for deadline extension
 * @returns Calculated deadline
 */
export function calculateOfflineDeadline(
  mode: OfflineMode, 
  generatedAt: Date = new Date(),
  maintenanceWindow?: MaintenanceWindow
): Date {
  const deadline = new Date(generatedAt);
  
  switch (mode) {
    case 'offline24':
      // Must be submitted within 24 hours from generation
      deadline.setHours(deadline.getHours() + 24);
      break;
      
    case 'offline':
    case 'awaryjny':
    case 'awaria_calkowita':
      // For system unavailability modes, deadline calculation is pending official guidance
      // Currently: assume 24h after maintenance window ends (if known), otherwise 7 days
      if (maintenanceWindow?.endTime) {
        const maintenanceEnd = new Date(maintenanceWindow.endTime);
        deadline.setTime(maintenanceEnd.getTime());
        deadline.setHours(deadline.getHours() + 24); // 24h after system is back
      } else {
        // Conservative fallback: 7 days from generation
        deadline.setDate(deadline.getDate() + 7);
      }
      break;
      
    default:
      throw new Error(`Unknown offline mode: ${mode}`);
  }
  
  return deadline;
}

/**
 * Extend deadline based on maintenance window
 * Used when maintenance window is updated or extended
 * 
 * @param currentDeadline Current deadline
 * @param maintenanceWindow Updated maintenance window
 * @returns New extended deadline
 */
export function extendDeadlineForMaintenance(
  currentDeadline: Date,
  maintenanceWindow: MaintenanceWindow
): Date {
  if (!maintenanceWindow.endTime) {
    // If maintenance end time is unknown, keep current deadline
    return currentDeadline;
  }
  
  const maintenanceEnd = new Date(maintenanceWindow.endTime);
  const extendedDeadline = new Date(maintenanceEnd);
  extendedDeadline.setHours(extendedDeadline.getHours() + 24); // 24h after maintenance ends
  
  // Only extend if new deadline is later than current
  return extendedDeadline > currentDeadline ? extendedDeadline : currentDeadline;
}

/**
 * External maintenance window API interface
 * Implement this to integrate with your external storage system
 * that tracks KSeF system availability and maintenance windows
 */
export interface MaintenanceWindowAPI {
  /**
   * Get current active maintenance window (if any)
   * @returns Active maintenance window or null if system is available
   */
  getCurrentMaintenanceWindow(): Promise<MaintenanceWindow | null>;
  
  /**
   * Get maintenance window by ID
   * @param id Maintenance window ID
   */
  getMaintenanceWindow(id: string): Promise<MaintenanceWindow | null>;
  
  /**
   * Register a new maintenance window (when system becomes unavailable)
   * @param window Maintenance window information
   */
  registerMaintenanceWindow(window: Omit<MaintenanceWindow, 'id'>): Promise<MaintenanceWindow>;
  
  /**
   * Update maintenance window (e.g., extend end time, mark as ended)
   * @param id Maintenance window ID
   * @param updates Partial updates
   */
  updateMaintenanceWindow(
    id: string, 
    updates: Partial<Omit<MaintenanceWindow, 'id'>>
  ): Promise<MaintenanceWindow>;
  
  /**
   * Get all invoices affected by a maintenance window
   * @param maintenanceWindowId Maintenance window ID
   */
  getAffectedInvoices(maintenanceWindowId: string): Promise<OfflineInvoiceMetadata[]>;
  
  /**
   * Extend deadlines for all invoices in a maintenance window
   * @param maintenanceWindowId Maintenance window ID
   * @param newDeadline New deadline or null to calculate automatically
   */
  extendInvoiceDeadlines(
    maintenanceWindowId: string,
    newDeadline?: Date
  ): Promise<{ updated: number; invoices: OfflineInvoiceMetadata[] }>;
}

/**
 * Check if offline invoice is expired
 */
export function isOfflineInvoiceExpired(submitBy: string | Date): boolean {
  const deadline = typeof submitBy === 'string' ? new Date(submitBy) : submitBy;
  return deadline < new Date();
}

/**
 * Get time remaining until deadline (in milliseconds)
 */
export function getTimeUntilDeadline(submitBy: string | Date): number {
  const deadline = typeof submitBy === 'string' ? new Date(submitBy) : submitBy;
  return Math.max(0, deadline.getTime() - Date.now());
}

/**
 * Helper to determine default reason based on offline mode
 */
export function getDefaultOfflineReason(mode: OfflineMode): OfflineReason {
  switch (mode) {
    case 'offline24':
      return OfflineReason.PLANNED;
    case 'offline':
      return OfflineReason.SYSTEM_UNAVAILABLE;
    case 'awaryjny':
      return OfflineReason.EMERGENCY;
    case 'awaria_calkowita':
      return OfflineReason.TOTAL_FAILURE;
    default:
      return OfflineReason.PLANNED;
  }
}

