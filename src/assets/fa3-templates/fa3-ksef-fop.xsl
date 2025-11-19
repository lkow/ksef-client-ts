<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:crd="http://crd.gov.pl/wzor/2025/02/14/02141/">

    <!-- FA3 Template inspired by ksef-fop repository -->
    <!-- Adapted for HTML output instead of PDF -->
    
    <xsl:output method="html" version="5.0" encoding="UTF-8" indent="yes"/>
    
    <!-- Main template -->
    <xsl:template match="/">
        <html lang="pl">
            <head>
                <meta charset="UTF-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <title>FA(3) KSeF - Ksef-fop Style</title>
                <style>
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                        line-height: 1.6; 
                        color: #333;
                        background-color: #f5f5f5;
                        padding: 20px;
                        margin: 0;
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
                        background: linear-gradient(135deg, #1e3c72, #2a5298);
                        color: white;
                        padding: 30px;
                        text-align: center;
                        position: relative;
                    }
                    
                    .header h1 {
                        font-size: 2.5em;
                        margin-bottom: 10px;
                    }
                    
                    .header p {
                        font-size: 1.2em;
                        opacity: 0.9;
                    }
                    
                    .badge {
                        display: inline-block;
                        background: #ff6b35;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 0.9em;
                        font-weight: bold;
                        margin-top: 15px;
                    }
                    
                    .content {
                        padding: 30px;
                    }
                    
                    .invoice-meta {
                        background: #e8f4fd;
                        border-left: 4px solid #2a5298;
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
                        border-bottom: 2px solid #2a5298;
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
                        border-bottom: 2px solid #2a5298;
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
                    
                    .footer {
                        background: #2c3e50;
                        color: white;
                        text-align: center;
                        padding: 20px;
                        margin-top: 30px;
                    }
                    
                    .footer a {
                        color: #2a5298;
                        text-decoration: none;
                    }
                    
                    .footer a:hover {
                        text-decoration: underline;
                    }
                    
                    @media (max-width: 768px) {
                        .parties-section {
                            grid-template-columns: 1fr;
                        }
                        
                        .invoice-meta {
                            grid-template-columns: 1fr;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📄 FA(3) KSeF</h1>
                        <p>Faktura elektroniczna - Ksef-fop Style</p>
                        <div class="badge">FA3 KSEF-FOP</div>
                    </div>
                    
                    <div class="content">
                        <xsl:apply-templates select="crd:Faktura"/>
                    </div>
                    
                    <div class="footer">
                        <p>Wygenerowano przez <a href="https://github.com/your-org/ksef-client">KSeF Client Library</a></p>
                        <p>Używa szablonu FA3 inspirowanego przez <a href="https://github.com/ksef4dev/ksef-fop">ksef-fop</a></p>
                        <p>Wszystkie wizualizacje są gotowe do użycia w aplikacjach biznesowych</p>
                    </div>
                </div>
            </body>
        </html>
    </xsl:template>
    
    <!-- Main invoice template -->
    <xsl:template match="crd:Faktura">
        <div class="invoice-meta">
            <div class="meta-item">
                <div class="meta-label">Numer faktury</div>
                <div class="meta-value">
                    <xsl:value-of select="crd:P_2A"/>
                </div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Data wystawienia</div>
                <div class="meta-value">
                    <xsl:value-of select="crd:P_1"/>
                </div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Data sprzedaży</div>
                <div class="meta-value">
                    <xsl:value-of select="crd:P_6"/>
                </div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Miejsce wystawienia</div>
                <div class="meta-value">
                    <xsl:value-of select="crd:P_7"/>
                </div>
            </div>
        </div>
        
        <div class="parties-section">
            <div class="party-card">
                <div class="party-title">🏢 Sprzedawca</div>
                <xsl:apply-templates select="crd:Podmiot1"/>
            </div>
            
            <div class="party-card">
                <div class="party-title">👤 Nabywca</div>
                <xsl:apply-templates select="crd:Podmiot2"/>
            </div>
        </div>
        
        <xsl:if test="crd:FaWiersz">
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
                        <xsl:apply-templates select="crd:FaWiersz"/>
                    </tbody>
                </table>
            </div>
        </xsl:if>
        
        <div class="amounts-section">
            <div class="section-title">💰 Podsumowanie</div>
            <div class="amount-row">
                <span class="amount-label">Wartość netto:</span>
                <span class="amount-value">
                    <xsl:value-of select="crd:P_13"/> zł
                </span>
            </div>
            <div class="amount-row">
                <span class="amount-label">Kwota VAT:</span>
                <span class="amount-value">
                    <xsl:value-of select="crd:P_14"/> zł
                </span>
            </div>
            <div class="amount-row">
                <span class="amount-label">Wartość brutto:</span>
                <span class="amount-value">
                    <xsl:value-of select="crd:P_15"/> zł
                </span>
            </div>
        </div>
    </xsl:template>
    
    <!-- Party template -->
    <xsl:template match="crd:Podmiot1 | crd:Podmiot2">
        <div class="party-info">
            <div class="party-label">Nazwa</div>
            <div class="party-value">
                <xsl:value-of select="crd:Nazwa"/>
            </div>
        </div>
        <div class="party-info">
            <div class="party-label">NIP</div>
            <div class="party-value">
                <xsl:value-of select="crd:NIP"/>
            </div>
        </div>
        <div class="party-info">
            <div class="party-label">Adres</div>
            <div class="party-value">
                <xsl:value-of select="crd:AdresL1"/>
            </div>
            <div class="party-value">
                <xsl:value-of select="crd:AdresL2"/>
            </div>
        </div>
    </xsl:template>
    
    <!-- Invoice row template -->
    <xsl:template match="crd:FaWiersz">
        <tr>
            <td>
                <xsl:value-of select="position()"/>
            </td>
            <td>
                <xsl:value-of select="crd:P_8B"/>
            </td>
            <td>
                <xsl:value-of select="crd:P_9"/>
            </td>
            <td>
                <xsl:value-of select="crd:P_10"/>
            </td>
            <td>
                <xsl:value-of select="crd:P_11"/>
            </td>
            <td>
                <xsl:value-of select="crd:P_12"/>
            </td>
            <td>
                <xsl:value-of select="crd:P_13"/>
            </td>
            <td>
                <xsl:value-of select="crd:P_14"/>
            </td>
        </tr>
    </xsl:template>
    
</xsl:stylesheet>

