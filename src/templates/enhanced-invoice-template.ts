/**
 * Enhanced HTML template inspired by ksef-fop professional layouts
 * Provides better structure, styling, and user experience
 */

export function createEnhancedInvoiceHtml(xml: string, sampleNumber: string = 'Custom'): string {
  try {
    // Enhanced XML parsing with better error handling
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
    const dataWytworzenia = extractValue('DataWytworzeniaFa') || extractValue('DataWytworzeniaJPK') || '';
    const systemInfo = extractValue('SystemInfo') || extractValue('NazwaSystemu') || '';
    
    // Extract seller info (Podmiot1)
    const sellerNip = xml.match(/<Podmiot1>[\s\S]*?<NIP>([^<]*)<\/NIP>/i)?.[1] || '';
    const sellerName = xml.match(/<Podmiot1>[\s\S]*?<Nazwa>([^<]*)<\/Nazwa>/i)?.[1] || '';
    const sellerEmail = xml.match(/<Podmiot1>[\s\S]*?<Email>([^<]*)<\/Email>/i)?.[1] || '';
    const sellerPhone = xml.match(/<Podmiot1>[\s\S]*?<Telefon>([^<]*)<\/Telefon>/i)?.[1] || '';
    
    // Extract seller address (Podmiot1)
    const sellerCountry = xml.match(/<Podmiot1>[\s\S]*?<KodKraju>([^<]*)<\/KodKraju>/i)?.[1] || 'PL';
    const sellerAddressL1 = xml.match(/<Podmiot1>[\s\S]*?<AdresL1>([^<]*)<\/AdresL1>/i)?.[1] || '';
    const sellerAddressL2 = xml.match(/<Podmiot1>[\s\S]*?<AdresL2>([^<]*)<\/AdresL2>/i)?.[1] || '';
    
    // Extract buyer info (Podmiot2)
    const buyerNip = xml.match(/<Podmiot2>[\s\S]*?<NIP>([^<]*)<\/NIP>/i)?.[1] || '';
    const buyerName = xml.match(/<Podmiot2>[\s\S]*?<Nazwa>([^<]*)<\/Nazwa>/i)?.[1] || '';
    const buyerEmail = xml.match(/<Podmiot2>[\s\S]*?<Email>([^<]*)<\/Email>/i)?.[1] || '';
    const buyerPhone = xml.match(/<Podmiot2>[\s\S]*?<Telefon>([^<]*)<\/Telefon>/i)?.[1] || '';
    const buyerClientNumber = xml.match(/<Podmiot2>[\s\S]*?<NrKlienta>([^<]*)<\/NrKlienta>/i)?.[1] || '';
    
    // Extract buyer address (Podmiot2)
    const buyerCountry = xml.match(/<Podmiot2>[\s\S]*?<KodKraju>([^<]*)<\/KodKraju>/i)?.[1] || '';
    const buyerAddressL1 = xml.match(/<Podmiot2>[\s\S]*?<AdresL1>([^<]*)<\/AdresL1>/i)?.[1] || '';
    const buyerAddressL2 = xml.match(/<Podmiot2>[\s\S]*?<AdresL2>([^<]*)<\/AdresL2>/i)?.[1] || '';
    
    // Extract invoice details
    const invoiceDate = extractValue('P_1') || '';
    const invoiceNumber = extractValue('P_2A') || '';
    const saleDate = extractValue('P_6') || '';
    const salePlace = extractValue('P_7') || '';
    const grossAmount = extractValue('P_15') || '';
    const netAmount = extractValue('P_13') || '';
    const vatAmount = extractValue('P_14') || '';
    
    // Extract payment info
    const paymentMethod = extractValue('P_16') || '';
    const paymentDueDate = extractValue('P_17') || '';
    const bankAccount = extractValue('P_18') || '';
    
    // Extract invoice items
    const invoiceItems = extractInvoiceItems(xml);
    
    return `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>e-FAKTURA KSeF - ${invoiceNumber || sampleNumber}</title>
    <style>
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #2c3e50, #3498db);
            color: white;
            padding: 30px;
            text-align: center;
            position: relative;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
            opacity: 0.3;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
        }
        
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
            position: relative;
            z-index: 1;
        }
        
        .badge {
            display: inline-block;
            background: #28a745;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
            margin-top: 15px;
            position: relative;
            z-index: 1;
        }
        
        .content {
            padding: 30px;
        }
        
        .invoice-meta {
            background: #e8f4fd;
            border-left: 4px solid #3498db;
            padding: 20px;
            margin-bottom: 30px;
            border-radius: 0 4px 4px 0;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .meta-item {
            display: flex;
            flex-direction: column;
        }
        
        .meta-label {
            font-size: 0.8em;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        
        .meta-value {
            font-size: 1.1em;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .parties-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        
        .party-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            border: 1px solid #e9ecef;
        }
        
        .party-title {
            font-size: 1.2em;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #3498db;
        }
        
        .party-info {
            margin-bottom: 10px;
        }
        
        .party-label {
            font-size: 0.8em;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .party-value {
            font-size: 1em;
            color: #333;
            margin-top: 2px;
        }
        
        .items-section {
            margin-bottom: 30px;
        }
        
        .section-title {
            font-size: 1.4em;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #3498db;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .items-table th {
            background: #2c3e50;
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        
        .items-table td {
            padding: 15px;
            border-bottom: 1px solid #e9ecef;
        }
        
        .items-table tr:hover {
            background-color: #f8f9fa;
        }
        
        .amounts-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        
        .amount-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #e9ecef;
        }
        
        .amount-row:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 1.2em;
            color: #2c3e50;
            background: #e8f4fd;
            margin: 10px -20px -20px -20px;
            padding: 15px 20px;
            border-radius: 0 0 8px 8px;
        }
        
        .amount-label {
            color: #666;
        }
        
        .amount-value {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .payment-section {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        
        .payment-title {
            font-size: 1.2em;
            font-weight: bold;
            color: #856404;
            margin-bottom: 15px;
        }
        
        .payment-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .footer {
            background: #2c3e50;
            color: white;
            text-align: center;
            padding: 20px;
            margin-top: 30px;
        }
        
        .footer a {
            color: #3498db;
            text-decoration: none;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
        
        .sample-badge {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 0.8em;
            backdrop-filter: blur(10px);
        }
        
        @media (max-width: 768px) {
            .parties-section {
                grid-template-columns: 1fr;
            }
            
            .invoice-meta {
                grid-template-columns: 1fr;
            }
            
            .payment-info {
                grid-template-columns: 1fr;
            }
            
            .items-table {
                font-size: 0.9em;
            }
            
            .items-table th,
            .items-table td {
                padding: 10px 8px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="sample-badge">Sample: ${sampleNumber}</div>
            <h1>📄 e-FAKTURA KSeF</h1>
            <p>${kodFormularza} (${wariant}) - ${kodSystemowy}</p>
            <div class="badge">FA(3) WIZUALIZACJA</div>
        </div>
        
        <div class="content">
            <div class="invoice-meta">
                <div class="meta-item">
                    <div class="meta-label">Numer faktury</div>
                    <div class="meta-value">${invoiceNumber || 'Brak'}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Data wystawienia</div>
                    <div class="meta-value">${invoiceDate || 'Brak'}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Data sprzedaży</div>
                    <div class="meta-value">${saleDate || 'Brak'}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Miejsce wystawienia</div>
                    <div class="meta-value">${salePlace || 'Brak'}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">System</div>
                    <div class="meta-value">${systemInfo || 'Brak'}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Data wytworzenia</div>
                    <div class="meta-value">${dataWytworzenia || 'Brak'}</div>
                </div>
            </div>
            
            <div class="parties-section">
                <div class="party-card">
                    <div class="party-title">🏢 Sprzedawca</div>
                    <div class="party-info">
                        <div class="party-label">Nazwa</div>
                        <div class="party-value">${sellerName || 'Brak danych'}</div>
                    </div>
                    <div class="party-info">
                        <div class="party-label">NIP</div>
                        <div class="party-value">${sellerNip || 'Brak danych'}</div>
                    </div>
                    <div class="party-info">
                        <div class="party-label">Adres</div>
                        <div class="party-value">${sellerAddressL1 || 'Brak danych'}</div>
                        <div class="party-value">${sellerAddressL2 || ''}</div>
                    </div>
                    ${sellerEmail ? `
                    <div class="party-info">
                        <div class="party-label">Email</div>
                        <div class="party-value">${sellerEmail}</div>
                    </div>
                    ` : ''}
                    ${sellerPhone ? `
                    <div class="party-info">
                        <div class="party-label">Telefon</div>
                        <div class="party-value">${sellerPhone}</div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="party-card">
                    <div class="party-title">👤 Nabywca</div>
                    <div class="party-info">
                        <div class="party-label">Nazwa</div>
                        <div class="party-value">${buyerName || 'Brak danych'}</div>
                    </div>
                    <div class="party-info">
                        <div class="party-label">NIP</div>
                        <div class="party-value">${buyerNip || 'Brak danych'}</div>
                    </div>
                    <div class="party-info">
                        <div class="party-label">Adres</div>
                        <div class="party-value">${buyerAddressL1 || 'Brak danych'}</div>
                        <div class="party-value">${buyerAddressL2 || ''}</div>
                    </div>
                    ${buyerEmail ? `
                    <div class="party-info">
                        <div class="party-label">Email</div>
                        <div class="party-value">${buyerEmail}</div>
                    </div>
                    ` : ''}
                    ${buyerPhone ? `
                    <div class="party-info">
                        <div class="party-label">Telefon</div>
                        <div class="party-value">${buyerPhone}</div>
                    </div>
                    ` : ''}
                    ${buyerClientNumber ? `
                    <div class="party-info">
                        <div class="party-label">Nr klienta</div>
                        <div class="party-value">${buyerClientNumber}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            ${invoiceItems.length > 0 ? `
            <div class="items-section">
                <div class="section-title">📦 Pozycje faktury</div>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Lp.</th>
                            <th>Nazwa</th>
                            <th>Ilość</th>
                            <th>Cena netto</th>
                            <th>Wartość netto</th>
                            <th>Stawka VAT</th>
                            <th>Kwota VAT</th>
                            <th>Wartość brutto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoiceItems.map((item, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${item.name}</td>
                            <td>${item.quantity}</td>
                            <td>${item.netPrice}</td>
                            <td>${item.netValue}</td>
                            <td>${item.vatRate}</td>
                            <td>${item.vatAmount}</td>
                            <td>${item.grossValue}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
            
            <div class="amounts-section">
                <div class="section-title">💰 Podsumowanie</div>
                <div class="amount-row">
                    <span class="amount-label">Wartość netto:</span>
                    <span class="amount-value">${netAmount || '0,00'} zł</span>
                </div>
                <div class="amount-row">
                    <span class="amount-label">Kwota VAT:</span>
                    <span class="amount-value">${vatAmount || '0,00'} zł</span>
                </div>
                <div class="amount-row">
                    <span class="amount-label">Wartość brutto:</span>
                    <span class="amount-value">${grossAmount || '0,00'} zł</span>
                </div>
            </div>
            
            ${paymentMethod || paymentDueDate || bankAccount ? `
            <div class="payment-section">
                <div class="payment-title">💳 Informacje o płatności</div>
                <div class="payment-info">
                    ${paymentMethod ? `
                    <div class="meta-item">
                        <div class="meta-label">Sposób płatności</div>
                        <div class="meta-value">${paymentMethod}</div>
                    </div>
                    ` : ''}
                    ${paymentDueDate ? `
                    <div class="meta-item">
                        <div class="meta-label">Termin płatności</div>
                        <div class="meta-value">${paymentDueDate}</div>
                    </div>
                    ` : ''}
                    ${bankAccount ? `
                    <div class="meta-item">
                        <div class="meta-label">Numer konta</div>
                        <div class="meta-value">${bankAccount}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <p>Wygenerowano przez <a href="https://github.com/your-org/ksef-client">KSeF Client Library</a></p>
            <p>Używa ulepszonego schematu wizualizacji inspirowanego przez <a href="https://github.com/ksef4dev/ksef-fop">ksef-fop</a></p>
            <p>Wszystkie wizualizacje są gotowe do użycia w aplikacjach biznesowych</p>
        </div>
    </div>
</body>
</html>`;
  } catch (error) {
    return createFallbackHtml(xml, sampleNumber, error);
  }
}

function extractInvoiceItems(xml: string): Array<{
  name: string;
  quantity: string;
  netPrice: string;
  netValue: string;
  vatRate: string;
  vatAmount: string;
  grossValue: string;
}> {
  const items: Array<{
    name: string;
    quantity: string;
    netPrice: string;
    netValue: string;
    vatRate: string;
    vatAmount: string;
    grossValue: string;
  }> = [];

  try {
    // Extract invoice items using regex patterns
    const itemMatches = xml.match(/<FaWiersz>[\s\S]*?<\/FaWiersz>/gi);
    
    if (itemMatches) {
      itemMatches.forEach((itemXml, index) => {
        const name = itemXml.match(/<P_8B>([^<]*)<\/P_8B>/i)?.[1] || `Pozycja ${index + 1}`;
        const quantity = itemXml.match(/<P_9>([^<]*)<\/P_9>/i)?.[1] || '1';
        const netPrice = itemXml.match(/<P_10>([^<]*)<\/P_10>/i)?.[1] || '0,00';
        const netValue = itemXml.match(/<P_11>([^<]*)<\/P_11>/i)?.[1] || '0,00';
        const vatRate = itemXml.match(/<P_12>([^<]*)<\/P_12>/i)?.[1] || '0%';
        const vatAmount = itemXml.match(/<P_13>([^<]*)<\/P_13>/i)?.[1] || '0,00';
        const grossValue = itemXml.match(/<P_14>([^<]*)<\/P_14>/i)?.[1] || '0,00';

        items.push({
          name: name.trim(),
          quantity: quantity.trim(),
          netPrice: netPrice.trim(),
          netValue: netValue.trim(),
          vatRate: vatRate.trim(),
          vatAmount: vatAmount.trim(),
          grossValue: grossValue.trim()
        });
      });
    }
  } catch (error) {
    console.warn('Error extracting invoice items:', error);
  }

  return items;
}

function createFallbackHtml(xml: string, sampleNumber: string, error: any): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>e-FAKTURA KSeF - ${sampleNumber}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .error { background-color: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px; }
        .xml-content { background-color: #f8f9fa; padding: 20px; margin-top: 20px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>e-FAKTURA KSeF - ${sampleNumber}</h1>
    <div class="error">
        <h2>Błąd przetwarzania</h2>
        <p>Wystąpił błąd podczas generowania wizualizacji: ${error.message}</p>
    </div>
    <div class="xml-content">
        <h3>Zawartość XML:</h3>
        <pre>${xml.substring(0, 1000)}${xml.length > 1000 ? '...' : ''}</pre>
    </div>
</body>
</html>`;
}
