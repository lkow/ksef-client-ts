import type { SessionInvoiceStatus } from '../types/session.js';
import type {
  BatchCorrelatedResult,
  BatchManifestItem,
  BatchResultCorrelation
} from './types.js';

export function correlateBatchResults(
  manifest: BatchManifestItem[],
  sessionInvoices: SessionInvoiceStatus[]
): BatchResultCorrelation {
  const manifestByHash = new Map(manifest.map((item) => [item.invoiceHash, item]));
  const matched: BatchCorrelatedResult[] = [];
  const unmatchedSessionInvoices: SessionInvoiceStatus[] = [];
  const matchedHashes = new Set<string>();

  for (const sessionInvoice of sessionInvoices) {
    const manifestItem = manifestByHash.get(sessionInvoice.invoiceHash);
    if (!manifestItem) {
      unmatchedSessionInvoices.push(sessionInvoice);
      continue;
    }
    matched.push({
      localId: manifestItem.localId,
      fileName: manifestItem.fileName,
      invoiceHash: manifestItem.invoiceHash,
      invoiceSize: manifestItem.invoiceSize,
      sessionInvoice
    });
    matchedHashes.add(manifestItem.invoiceHash);
  }

  return {
    matched,
    unmatchedSessionInvoices,
    missingManifestItems: manifest.filter((item) => !matchedHashes.has(item.invoiceHash))
  };
}

export function mergeSessionInvoices(
  invoices: SessionInvoiceStatus[],
  failedInvoices: SessionInvoiceStatus[]
): SessionInvoiceStatus[] {
  const merged = new Map<string, SessionInvoiceStatus>();
  for (const invoice of [...invoices, ...failedInvoices]) {
    merged.set(invoice.referenceNumber || `${invoice.invoiceHash}:${invoice.ordinalNumber}`, invoice);
  }
  return Array.from(merged.values());
}
