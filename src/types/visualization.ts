/**
 * Visualization service types and interfaces
 * 
 * Note: This service transforms FA(3) XML invoices to HTML only.
 * PDF generation is explicitly not supported - use external tools like 
 * https://github.com/ksef4dev/ksef-fop for PDF generation if needed.
 */

export type VisualizationSchema = 'official' | 'enhanced';

export interface VisualizationRequest {
  invoiceXml: string;
  outputFormat: 'html';
  schema?: VisualizationSchema;
}

export interface VisualizationResponse {
  success: boolean;
  data?: string;
  contentType: string;
  error?: string;
  schema?: VisualizationSchema;
}

export interface VisualizationOptions {
  includeStyles?: boolean;
  customStyles?: string;
  pageTitle?: string;
  schema?: VisualizationSchema;
}

export interface StylesheetInfo {
  version: string;
  source: string;
}
