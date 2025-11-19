/**
 * Simplified visualization service for FA(3) invoices - HTML only
 * Transforms FA(3) XML to HTML using custom styling
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { z } from 'zod';
import type { VisualizationRequest, VisualizationResponse, VisualizationOptions } from '../types/visualization.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Input validation schemas
const VisualizationRequestSchema = z.object({
  invoiceXml: z.string().min(1, 'Invoice XML is required'),
  outputFormat: z.enum(['html']).default('html')
});

export class VisualizationService {
  private xslStylesheet!: string;
  private readonly assetsPath: string;

  constructor() {
    this.assetsPath = join(__dirname, '../assets');
    this.loadXslStylesheet();
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
   * Transform FA(3) XML to HTML
   */
  async transformToHtml(
    invoiceXml: string, 
    options: VisualizationOptions = {}
  ): Promise<string> {
    try {
      // Validate XML structure
      this.validateXmlStructure(invoiceXml);

      // Create HTML representation
      const html = this.createSimpleHtml(invoiceXml);

      // Enhance HTML with additional options
      return this.enhanceHtml(html, options);
    } catch (error) {
      throw new Error(`HTML transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Main visualization method - HTML only
   */
  async visualize(request: VisualizationRequest): Promise<VisualizationResponse> {
    try {
      // Validate input
      const validatedRequest = VisualizationRequestSchema.parse(request);

      const data = await this.transformToHtml(validatedRequest.invoiceXml);
      const contentType = 'text/html; charset=utf-8';

      return {
        success: true,
        data,
        contentType
      };
    } catch (error) {
      return {
        success: false,
        contentType: 'text/plain',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Create a comprehensive HTML representation of the FA(3) invoice
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

      // Extract comprehensive information
      const kodFormularza = extractValue('KodFormularza') || 'FA';
      const kodSystemowy = extractAttribute('KodFormularza', 'kodSystemowy') || 'FA(3)';
      const wariant = extractValue('WariantFormularza') || '3';
      const dataWytworzenia = extractValue('DataWytworzeniaJPK') || '';
      const dataOd = extractValue('DataOd') || '';
      const dataDo = extractValue('DataDo') || '';
      const nazwaSystemu = extractValue('NazwaSystemu') || '';
      
      // Extract seller info
      const sellerNip = extractValue('NIP') || '';
      const sellerName = extractValue('PelnaNazwa') || '';
      const sellerTradeName = extractValue('NazwaSkrocona') || '';
      
      // Extract seller address
      const sellerCountry = extractValue('KodKraju') || 'PL';
      const sellerProvince = extractValue('Wojewodztwo') || '';
      const sellerDistrict = extractValue('Powiat') || '';
      const sellerCommune = extractValue('Gmina') || '';
      const sellerStreet = extractValue('Ulica') || '';
      const sellerHouseNumber = extractValue('NrDomu') || '';
      const sellerPostalCode = extractValue('KodPocztowy') || '';
      const sellerPostOffice = extractValue('Poczta') || '';
      
      // Extract invoice details
      const invoiceDate = extractValue('P_1') || '';
      const invoiceNumber = extractValue('P_2A') || '';
      const saleDate = extractValue('P_6') || '';
      const netAmount = extractValue('P_13_1') || '';
      const vatAmount = extractValue('P_14_1') || '';
      const grossAmount = extractValue('P_15') || '';
      
      // Extract buyer info
      const buyerNip = xml.match(/<P_3A>[\s\S]*?<NIP>([^<]*)<\/NIP>/i)?.[1] || '';
      const buyerName = xml.match(/<P_3A>[\s\S]*?<Nazwa>([^<]*)<\/Nazwa>/i)?.[1] || '';
      
      // Extract invoice items
      const invoiceItems = this.extractInvoiceItems(xml);
      
      return `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>e-FAKTURA KSeF - ${invoiceNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header { 
            background: linear-gradient(135deg, #2c5aa0 0%, #1e3a5f 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
            font-weight: 300;
        }
        .header .subtitle {
            font-size: 16px;
            opacity: 0.9;
        }
        .invoice-meta {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #e9ecef;
        }
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .meta-item {
            display: flex;
            flex-direction: column;
        }
        .meta-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 5px;
        }
        .meta-value {
            font-size: 14px;
            font-weight: 500;
        }
        .parties {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            padding: 30px;
            border-bottom: 1px solid #e9ecef;
        }
        .party {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #2c5aa0;
        }
        .party h3 {
            color: #2c5aa0;
            margin-bottom: 15px;
            font-size: 18px;
        }
        .party-info {
            margin-bottom: 10px;
        }
        .party-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            font-weight: 600;
        }
        .party-value {
            font-size: 14px;
            margin-top: 2px;
        }
        .amounts {
            background: linear-gradient(135deg, #e8f4fd 0%, #d1ecf1 100%);
            padding: 30px;
            text-align: center;
        }
        .amount-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .amount-item {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .amount-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .amount-value {
            font-size: 20px;
            font-weight: bold;
            color: #2c5aa0;
        }
        .total-amount {
            font-size: 32px;
            font-weight: bold;
            color: #1e3a5f;
            margin-top: 10px;
        }
        .items {
            padding: 30px;
        }
        .items h3 {
            color: #2c5aa0;
            margin-bottom: 20px;
            font-size: 18px;
        }
        .item {
            background: #f8f9fa;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 6px;
            border-left: 3px solid #2c5aa0;
        }
        .item-name {
            font-weight: 600;
            margin-bottom: 5px;
        }
        .item-details {
            font-size: 14px;
            color: #666;
        }
        .footer {
            background: #2c5aa0;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 12px;
        }
        .note {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            margin: 20px;
            border-radius: 6px;
            font-style: italic;
        }
        @media (max-width: 768px) {
            .parties {
                grid-template-columns: 1fr;
            }
            .meta-grid {
                grid-template-columns: 1fr;
            }
            .amount-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>e-FAKTURA KSeF</h1>
            <div class="subtitle">${kodSystemowy} - Wariant ${wariant}</div>
        </div>
        
        <div class="invoice-meta">
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">Numer faktury</div>
                    <div class="meta-value">${invoiceNumber}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Data faktury</div>
                    <div class="meta-value">${invoiceDate}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Data sprzedaży</div>
                    <div class="meta-value">${saleDate}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Data wytworzenia</div>
                    <div class="meta-value">${dataWytworzenia}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Okres od</div>
                    <div class="meta-value">${dataOd}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Okres do</div>
                    <div class="meta-value">${dataDo}</div>
                </div>
            </div>
        </div>
        
        <div class="parties">
            <div class="party">
                <h3>📤 Sprzedawca</h3>
                <div class="party-info">
                    <div class="party-label">NIP</div>
                    <div class="party-value">${sellerNip}</div>
                </div>
                <div class="party-info">
                    <div class="party-label">Nazwa</div>
                    <div class="party-value">${sellerName}</div>
                </div>
                ${sellerTradeName ? `
                <div class="party-info">
                    <div class="party-label">Nazwa skrócona</div>
                    <div class="party-value">${sellerTradeName}</div>
                </div>
                ` : ''}
                <div class="party-info">
                    <div class="party-label">Adres</div>
                    <div class="party-value">
                        ${sellerStreet} ${sellerHouseNumber}<br>
                        ${sellerPostalCode} ${sellerPostOffice}<br>
                        ${sellerCommune}, ${sellerDistrict}<br>
                        ${sellerProvince}, ${sellerCountry}
                    </div>
                </div>
            </div>
            
            <div class="party">
                <h3>📥 Nabywca</h3>
                <div class="party-info">
                    <div class="party-label">NIP</div>
                    <div class="party-value">${buyerNip}</div>
                </div>
                <div class="party-info">
                    <div class="party-label">Nazwa</div>
                    <div class="party-value">${buyerName}</div>
                </div>
            </div>
        </div>
        
        <div class="amounts">
            <div class="amount-grid">
                <div class="amount-item">
                    <div class="amount-label">Kwota netto</div>
                    <div class="amount-value">${netAmount} PLN</div>
                </div>
                <div class="amount-item">
                    <div class="amount-label">Kwota VAT</div>
                    <div class="amount-value">${vatAmount} PLN</div>
                </div>
            </div>
            <div class="total-amount">${grossAmount} PLN</div>
        </div>
        
        ${invoiceItems.length > 0 ? `
        <div class="items">
            <h3>📋 Pozycje faktury</h3>
            ${invoiceItems.map(item => `
                <div class="item">
                    <div class="item-name">${item.name}</div>
                    <div class="item-details">
                        Ilość: ${item.quantity} ${item.unit} | 
                        Cena: ${item.price} PLN | 
                        Wartość: ${item.value} PLN | 
                        VAT: ${item.vatRate}%
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="footer">
            <p>Wygenerowano przez system: ${nazwaSystemu}</p>
            <p>e-FAKTURA KSeF - Krajowy System e-Faktur</p>
        </div>
        
        <div class="note">
            <strong>Uwaga:</strong> To jest wizualizacja faktury FA(3) wygenerowana przez system KSeF. 
            Dokument ma charakter informacyjny i może wymagać dodatkowego formatowania zgodnie z wymogami prawnymi.
        </div>
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
    <title>e-FAKTURA KSeF - Błąd</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .error { color: red; background: #ffe6e6; padding: 20px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>e-FAKTURA KSeF</h1>
    <div class="error">
        <h2>Błąd podczas przetwarzania faktury FA(3)</h2>
        <p>Wystąpił problem podczas analizy dokumentu XML.</p>
    </div>
    <details>
        <summary>Zawartość XML (do debugowania)</summary>
        <pre>${xml}</pre>
    </details>
</body>
</html>`;
    }
  }

  /**
   * Extract invoice items from XML
   */
  private extractInvoiceItems(xml: string): Array<{
    name: string;
    quantity: string;
    unit: string;
    price: string;
    value: string;
    vatRate: string;
  }> {
    const items: Array<{
      name: string;
      quantity: string;
      unit: string;
      price: string;
      value: string;
      vatRate: string;
    }> = [];

    // Extract FaWiersz elements
    const faWierszMatches = xml.match(/<FaWiersz>[\s\S]*?<\/FaWiersz>/gi);
    
    if (faWierszMatches) {
      faWierszMatches.forEach((wierszXml, index) => {
        const extractValue = (pattern: string): string => {
          const match = wierszXml.match(new RegExp(`<${pattern}[^>]*>([^<]*)</${pattern}>`, 'i'));
          return match ? match[1]?.trim() || '' : '';
        };

        items.push({
          name: extractValue('P_7') || `Pozycja ${index + 1}`,
          quantity: extractValue('P_8B') || '',
          unit: extractValue('P_8A') || '',
          price: extractValue('P_9A') || '',
          value: extractValue('P_11') || '',
          vatRate: extractValue('P_12') || ''
        });
      });
    }

    return items;
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
