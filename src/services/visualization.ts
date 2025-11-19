/**
 * Visualization service for FA(3) invoices
 * Transforms FA(3) XML to HTML using XSLT stylesheets
 * 
 * Supports two schemas:
 * - 'official': Uses official Polish government XSLT (styl.xsl)
 * - 'enhanced': Uses modern, responsive HTML template (default)
 * 
 * Note: PDF generation is explicitly not supported. For PDF output, convert the HTML
 * using external tools or see https://github.com/ksef4dev/ksef-fop
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { z } from 'zod';
import type { VisualizationRequest, VisualizationResponse, VisualizationOptions, VisualizationSchema } from '../types/visualization.js';
import SaxonJS from 'saxon-js';
import { createEnhancedInvoiceHtml } from '../templates/enhanced-invoice-template.js';
import { createUpoHtml } from '../templates/upo-template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Input validation schemas
const VisualizationRequestSchema = z.object({
  invoiceXml: z.string().min(1, 'Invoice XML is required'),
  outputFormat: z.enum(['html']).default('html'),
  schema: z.enum(['official', 'enhanced']).optional().default('enhanced')
});

export class VisualizationService {
  private xslStylesheet!: string;
  private sefStylesheet!: string;
  private readonly assetsPath: string;

  constructor() {
    this.assetsPath = join(__dirname, '../assets');
    this.loadXslStylesheet();
    try {
      this.loadSefStylesheet();
    } catch (error) {
      console.warn('SEF stylesheet loading failed, will fall back to enhanced schema:', error);
      // Don't throw error, just log warning
    }
  }

  /**
   * Load the XSL stylesheet from assets
   */
  private loadXslStylesheet(): void {
    try {
      // Try multiple possible paths for the XSL file
      const possiblePaths = [
        join(this.assetsPath, 'styl.xsl'),
        join(__dirname, '../assets/styl.xsl'),
        join(process.cwd(), 'src/assets/styl.xsl'),
        join(process.cwd(), 'dist/assets/styl.xsl')
      ];

      let xslPath: string | null = null;
      for (const path of possiblePaths) {
        try {
          readFileSync(path, 'utf-8');
          xslPath = path;
          break;
        } catch {
          // Continue to next path
        }
      }

      if (!xslPath) {
        throw new Error(`XSL stylesheet not found in any of the expected locations: ${possiblePaths.join(', ')}`);
      }

      this.xslStylesheet = readFileSync(xslPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to load XSL stylesheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load the SEF (Saxon Executable Format) stylesheet from assets
   */
  private loadSefStylesheet(): void {
    try {
      // Try multiple possible paths for the SEF file
      const possiblePaths = [
        join(this.assetsPath, 'styl.sef.json'),
        join(__dirname, '../assets/styl.sef.json'),
        join(process.cwd(), 'src/assets/styl.sef.json'),
        join(process.cwd(), 'dist/assets/styl.sef.json')
      ];

      let sefPath: string | null = null;
      for (const path of possiblePaths) {
        try {
          readFileSync(path, 'utf-8');
          sefPath = path;
          break;
        } catch {
          // Continue to next path
        }
      }

      if (!sefPath) {
        throw new Error(`SEF stylesheet not found in any of the expected locations: ${possiblePaths.join(', ')}`);
      }

      this.sefStylesheet = readFileSync(sefPath, 'utf-8');
    } catch (error) {
      console.error('Failed to load SEF stylesheet:', error);
      throw new Error(`Failed to load SEF stylesheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  /**
   * Transform FA(3) XML to HTML using official MF schema (styl.xsl)
   * Uses SaxonJS with compiled SEF to avoid external resource issues
   */
  async transformWithOfficialSchema(invoiceXml: string): Promise<string> {
    try {
      // Validate XML structure
      this.validateXmlStructure(invoiceXml);

      // Check if SEF stylesheet is available
      if (!this.sefStylesheet) {
        console.warn('SEF stylesheet not available, falling back to enhanced schema');
        return this.createSimpleHtml(invoiceXml);
      }

      // Use SaxonJS to transform with compiled SEF stylesheet
      const result = SaxonJS.transform({
        stylesheetInternal: JSON.parse(this.sefStylesheet),
        sourceText: invoiceXml,
        destination: 'serialized',
        outputProperties: {
          'method': 'html',
          'version': '5.0',
          'encoding': 'UTF-8',
          'indent': true
        }
      });

      return result.principalResult;
      
    } catch (error) {
      // Fallback to enhanced schema if official transformation fails
      console.warn('Official schema transformation failed, falling back to enhanced schema:', error);
      return this.createSimpleHtml(invoiceXml);
    }
  }

  /**
   * Transform FA(3) XML to HTML using enhanced schema
   * Uses professional template inspired by ksef-fop
   * Automatically detects UPO documents and uses appropriate template
   */
  async transformToHtml(
    invoiceXml: string, 
    options: VisualizationOptions = {}
  ): Promise<string> {
    try {
      // Validate XML structure
      this.validateXmlStructure(invoiceXml);

      // Extract sample name from XML for better display
      const sampleName = this.extractSampleName(invoiceXml);
      
      // Check if this is a UPO document
      if (this.isUpoDocument(invoiceXml)) {
        return createUpoHtml(invoiceXml, sampleName);
      }
      
      // Use enhanced template inspired by ksef-fop for invoices
      return createEnhancedInvoiceHtml(invoiceXml, sampleName);
      
    } catch (error) {
      console.warn('Enhanced schema transformation failed:', error);
      return this.createSimpleHtml(invoiceXml);
    }
  }


  /**
   * Main visualization method - HTML only
   */
  async visualize(request: VisualizationRequest): Promise<VisualizationResponse> {
    try {
      // Validate input
      const validatedRequest = VisualizationRequestSchema.parse(request);
      const schema = validatedRequest.schema || 'enhanced';

      let data: string;
      if (schema === 'official') {
        data = await this.transformWithOfficialSchema(validatedRequest.invoiceXml);
      } else {
        data = await this.transformToHtml(validatedRequest.invoiceXml);
      }

      const contentType = 'text/html; charset=utf-8';

      return {
        success: true,
        data,
        contentType,
        schema
      };
    } catch (error) {
      // Handle Zod validation errors with better messages
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        let errorMessage = 'Validation error';
        
        if (firstError && firstError.path.includes('invoiceXml')) {
          errorMessage = 'Invoice XML is required';
        } else if (firstError && firstError.message) {
          errorMessage = firstError.message;
        }
        
        return {
          success: false,
          contentType: 'text/plain',
          error: errorMessage
        };
      }
      
      return {
        success: false,
        contentType: 'text/plain',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Create a simple HTML representation of the FA(3) invoice
   * This is a temporary solution until proper XSLT transformation is implemented
   */
  private createSimpleHtml(xml: string): string {
    try {
      // Simple XML parsing using regex (for basic extraction)
      const extractValue = (pattern: string): string => {
        const match = xml.match(new RegExp(`<${pattern}[^>]*>([^<]*)</${pattern}>`, 'i'));
        return match ? match[1]?.trim() || '' : '';
      };

      const extractAttribute = (pattern: string, attr: string): string => {
        const match = xml.match(new RegExp(`<${pattern}[^>]*${attr}="([^"]*)"`, 'i'));
        return match ? match[1]?.trim() || '' : '';
      };

      // Extract basic information
      const kodFormularza = extractValue('KodFormularza') || 'FA';
      const wariant = extractValue('WariantFormularza') || '3';
      const dataWytworzenia = extractValue('DataWytworzeniaJPK') || '';
      const nazwaSystemu = extractValue('NazwaSystemu') || '';
      
      // Extract seller info
      const sellerNip = extractValue('NIP') || '';
      const sellerName = extractValue('PelnaNazwa') || '';
      
      // Extract invoice details
      const invoiceDate = extractValue('P_1') || '';
      const invoiceNumber = extractValue('P_2A') || '';
      const grossAmount = extractValue('P_15') || '';
      
      return `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>e-FAKTURA KSeF</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 20px; margin-bottom: 20px; }
        .invoice-info { background-color: #e8f4fd; padding: 15px; margin-bottom: 20px; }
        .seller-info { background-color: #f9f9f9; padding: 15px; margin-bottom: 20px; }
        .amount { font-size: 18px; font-weight: bold; color: #2c5aa0; }
        .note { font-style: italic; color: #666; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>e-FAKTURA KSeF</h1>
        <p><strong>Kod formularza:</strong> ${kodFormularza} (${wariant})</p>
        <p><strong>Data wytworzenia:</strong> ${dataWytworzenia}</p>
        <p><strong>Nazwa systemu:</strong> ${nazwaSystemu}</p>
    </div>
    
    <div class="seller-info">
        <h2>Dane sprzedawcy</h2>
        <p><strong>NIP:</strong> ${sellerNip}</p>
        <p><strong>Nazwa:</strong> ${sellerName}</p>
    </div>
    
    <div class="invoice-info">
        <h2>Dane faktury</h2>
        <p><strong>Data faktury:</strong> ${invoiceDate}</p>
        <p><strong>Numer faktury:</strong> ${invoiceNumber}</p>
        <p><strong>Kwota brutto:</strong> <span class="amount">${grossAmount} PLN</span></p>
    </div>
    
    <div class="note">
        <p><em>Uwaga: To jest uproszczona wizualizacja faktury FA(3). Pełna transformacja XSLT będzie dostępna po skonfigurowaniu odpowiednich stylów.</em></p>
    </div>
</body>
</html>`;
    } catch (error) {
      // Fallback HTML if XML parsing fails
      return `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <title>e-FAKTURA KSeF</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .error { color: red; }
    </style>
</head>
<body>
    <h1>e-FAKTURA KSeF</h1>
    <p class="error">Błąd podczas przetwarzania faktury FA(3).</p>
    <pre>${xml}</pre>
</body>
</html>`;
    }
  }

  /**
   * Validate XML structure
   */
  private validateXmlStructure(xml: string): void {
    // Basic XML validation
    if (!xml.trim().startsWith('<?xml') && !xml.trim().startsWith('<')) {
      throw new Error('Invalid XML format');
    }

    // Check for FA(3) specific elements
    if (!xml.includes('<Faktura') && !xml.includes('xmlns="http://crd.gov.pl/wzor/2025/02/14/02141/"')) {
      throw new Error('XML does not appear to be a valid FA(3) invoice');
    }
  }

  /**
   * Extract sample name from XML for better display
   */
  private extractSampleName(xml: string): string {
    try {
      // Try to extract invoice number first
      const invoiceNumber = xml.match(/<P_2A>([^<]*)<\/P_2A>/i)?.[1];
      if (invoiceNumber && invoiceNumber.trim()) {
        return invoiceNumber.trim();
      }

      // Fallback to system info
      const systemInfo = xml.match(/<SystemInfo>([^<]*)<\/SystemInfo>/i)?.[1];
      if (systemInfo && systemInfo.trim()) {
        return systemInfo.trim();
      }

      return 'Custom Invoice';
    } catch (error) {
      return 'Custom Invoice';
    }
  }

  /**
   * Check if the XML document is a UPO (Unified Payment Order)
   */
  private isUpoDocument(xml: string): boolean {
    try {
      // Check for UPO specific elements
      const kodFormularza = xml.match(/<KodFormularza[^>]*>([^<]*)<\/KodFormularza>/i)?.[1];
      if (kodFormularza && kodFormularza.trim().toUpperCase() === 'UPO') {
        return true;
      }

      // Check for UPO in namespace or other indicators
      if (xml.includes('UPO') || xml.includes('upo')) {
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Enhance HTML with additional styling and options
   */
  private enhanceHtml(html: string, options: VisualizationOptions): string {
    let enhancedHtml = html;

    // Add custom styles if provided
    if (options.customStyles) {
      const styleTag = `<style type="text/css">\n${options.customStyles}\n</style>`;
      enhancedHtml = enhancedHtml.replace('</head>', `${styleTag}\n</head>`);
    }

    // Set page title
    if (options.pageTitle) {
      enhancedHtml = enhancedHtml.replace(
        /<title>.*?<\/title>/i,
        `<title>${options.pageTitle}</title>`
      );
    }

    // Add responsive meta tag if not present
    if (!enhancedHtml.includes('viewport')) {
      const viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
      enhancedHtml = enhancedHtml.replace('</head>', `${viewportMeta}\n</head>`);
    }

    return enhancedHtml;
  }

  /**
   * Get supported output formats
   */
  getSupportedFormats(): string[] {
    return ['html'];
  }

  /**
   * Get XSL stylesheet version info
   */
  getStylesheetInfo(): { version: string; source: string } {
    return {
      version: '2025/06/25/13775',
      source: 'https://crd.gov.pl/wzor/2025/06/25/13775/styl.xsl'
    };
  }
}

// Export singleton instance
export const visualizationService = new VisualizationService();
