/**
 * UPO (Unified Payment Order) HTML template inspired by ksef-fop
 * Provides professional layout for payment order documents
 */

export function createUpoHtml(xml: string, sampleNumber: string = 'Custom'): string {
  try {
    // Enhanced XML parsing for UPO documents
    const extractValue = (pattern: string): string => {
      const match = xml.match(new RegExp(`<${pattern}[^>]*>([^<]*)</${pattern}>`, 'i'));
      return match ? match[1]?.trim() || '' : '';
    };

    const extractAttribute = (pattern: string, attr: string): string => {
      const match = xml.match(new RegExp(`<${pattern}[^>]*${attr}="([^"]*)"`, 'i'));
      return match ? match[1]?.trim() || '' : '';
    };

    // Extract UPO specific information
    const kodFormularza = extractValue('KodFormularza') || 'UPO';
    const wariant = extractValue('WariantFormularza') || '1';
    const dataWytworzenia = extractValue('DataWytworzeniaJPK') || '';
    const systemInfo = extractValue('NazwaSystemu') || '';
    
    // Extract payer info
    const payerNip = xml.match(/<Podmiot1>[\s\S]*?<NIP>([^<]*)<\/NIP>/i)?.[1] || '';
    const payerName = xml.match(/<Podmiot1>[\s\S]*?<Nazwa>([^<]*)<\/Nazwa>/i)?.[1] || '';
    const payerAddress = xml.match(/<Podmiot1>[\s\S]*?<AdresL1>([^<]*)<\/AdresL1>/i)?.[1] || '';
    
    // Extract payee info
    const payeeNip = xml.match(/<Podmiot2>[\s\S]*?<NIP>([^<]*)<\/NIP>/i)?.[1] || '';
    const payeeName = xml.match(/<Podmiot2>[\s\S]*?<Nazwa>([^<]*)<\/Nazwa>/i)?.[1] || '';
    const payeeAddress = xml.match(/<Podmiot2>[\s\S]*?<AdresL1>([^<]*)<\/AdresL1>/i)?.[1] || '';
    
    // Extract payment details
    const paymentAmount = extractValue('P_15') || '';
    const paymentDate = extractValue('P_1') || '';
    const paymentPurpose = extractValue('P_16') || '';
    const bankAccount = extractValue('P_18') || '';
    const paymentMethod = extractValue('P_17') || '';
    
    return `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UPO KSeF - ${sampleNumber}</title>
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
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #8e44ad, #9b59b6);
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
            background: #e74c3c;
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
        
        .upo-meta {
            background: #f3e5f5;
            border-left: 4px solid #9b59b6;
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
            border-bottom: 2px solid #9b59b6;
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
        
        .payment-section {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 25px;
            margin-bottom: 30px;
        }
        
        .payment-title {
            font-size: 1.4em;
            font-weight: bold;
            color: #856404;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #ffc107;
        }
        
        .payment-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        
        .payment-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        
        .payment-label {
            font-size: 0.8em;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        
        .payment-value {
            font-size: 1.1em;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .amount-highlight {
            background: #e8f5e8;
            border: 2px solid #28a745;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
        }
        
        .amount-label {
            font-size: 1em;
            color: #666;
            margin-bottom: 10px;
        }
        
        .amount-value {
            font-size: 2.5em;
            font-weight: bold;
            color: #28a745;
        }
        
        .purpose-section {
            background: #e3f2fd;
            border: 1px solid #bbdefb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        
        .purpose-title {
            font-size: 1.2em;
            font-weight: bold;
            color: #1976d2;
            margin-bottom: 15px;
        }
        
        .purpose-text {
            font-size: 1.1em;
            color: #333;
            line-height: 1.6;
        }
        
        .footer {
            background: #2c3e50;
            color: white;
            text-align: center;
            padding: 20px;
            margin-top: 30px;
        }
        
        .footer a {
            color: #9b59b6;
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
            
            .upo-meta {
                grid-template-columns: 1fr;
            }
            
            .payment-details {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="sample-badge">Sample: ${sampleNumber}</div>
            <h1>💳 UPO KSeF</h1>
            <p>${kodFormularza} (${wariant}) - Unified Payment Order</p>
            <div class="badge">UPO WIZUALIZACJA</div>
        </div>
        
        <div class="content">
            <div class="upo-meta">
                <div class="meta-item">
                    <div class="meta-label">Data wystawienia</div>
                    <div class="meta-value">${paymentDate || 'Brak'}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">System</div>
                    <div class="meta-value">${systemInfo || 'Brak'}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Data wytworzenia</div>
                    <div class="meta-value">${dataWytworzenia || 'Brak'}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Sposób płatności</div>
                    <div class="meta-value">${paymentMethod || 'Brak'}</div>
                </div>
            </div>
            
            <div class="parties-section">
                <div class="party-card">
                    <div class="party-title">👤 Płatnik</div>
                    <div class="party-info">
                        <div class="party-label">Nazwa</div>
                        <div class="party-value">${payerName || 'Brak danych'}</div>
                    </div>
                    <div class="party-info">
                        <div class="party-label">NIP</div>
                        <div class="party-value">${payerNip || 'Brak danych'}</div>
                    </div>
                    <div class="party-info">
                        <div class="party-label">Adres</div>
                        <div class="party-value">${payerAddress || 'Brak danych'}</div>
                    </div>
                </div>
                
                <div class="party-card">
                    <div class="party-title">🏢 Odbiorca</div>
                    <div class="party-info">
                        <div class="party-label">Nazwa</div>
                        <div class="party-value">${payeeName || 'Brak danych'}</div>
                    </div>
                    <div class="party-info">
                        <div class="party-label">NIP</div>
                        <div class="party-value">${payeeNip || 'Brak danych'}</div>
                    </div>
                    <div class="party-info">
                        <div class="party-label">Adres</div>
                        <div class="party-value">${payeeAddress || 'Brak danych'}</div>
                    </div>
                </div>
            </div>
            
            <div class="amount-highlight">
                <div class="amount-label">Kwota płatności</div>
                <div class="amount-value">${paymentAmount || '0,00'} zł</div>
            </div>
            
            <div class="payment-section">
                <div class="payment-title">💳 Szczegóły płatności</div>
                <div class="payment-details">
                    ${bankAccount ? `
                    <div class="payment-item">
                        <div class="payment-label">Numer konta</div>
                        <div class="payment-value">${bankAccount}</div>
                    </div>
                    ` : ''}
                    ${paymentMethod ? `
                    <div class="payment-item">
                        <div class="payment-label">Sposób płatności</div>
                        <div class="payment-value">${paymentMethod}</div>
                    </div>
                    ` : ''}
                    ${paymentDate ? `
                    <div class="payment-item">
                        <div class="payment-label">Data płatności</div>
                        <div class="payment-value">${paymentDate}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            ${paymentPurpose ? `
            <div class="purpose-section">
                <div class="purpose-title">📝 Cel płatności</div>
                <div class="purpose-text">${paymentPurpose}</div>
            </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <p>Wygenerowano przez <a href="https://github.com/your-org/ksef-client">KSeF Client Library</a></p>
            <p>Używa szablonu UPO inspirowanego przez <a href="https://github.com/ksef4dev/ksef-fop">ksef-fop</a></p>
            <p>Wszystkie wizualizacje UPO są gotowe do użycia w aplikacjach biznesowych</p>
        </div>
    </div>
</body>
</html>`;
  } catch (error) {
    return createUpoFallbackHtml(xml, sampleNumber, error);
  }
}

function createUpoFallbackHtml(xml: string, sampleNumber: string, error: any): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UPO KSeF - ${sampleNumber}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .error { background-color: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px; }
        .xml-content { background-color: #f8f9fa; padding: 20px; margin-top: 20px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>UPO KSeF - ${sampleNumber}</h1>
    <div class="error">
        <h2>Błąd przetwarzania</h2>
        <p>Wystąpił błąd podczas generowania wizualizacji UPO: ${error.message}</p>
    </div>
    <div class="xml-content">
        <h3>Zawartość XML:</h3>
        <pre>${xml.substring(0, 1000)}${xml.length > 1000 ? '...' : ''}</pre>
    </div>
</body>
</html>`;
}
