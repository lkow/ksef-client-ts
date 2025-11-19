/**
 * Tests for visualization service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VisualizationService, visualizationService } from '../dist/index.js';
import type { VisualizationRequest, VisualizationOptions } from '../dist/index.js';

// Sample FA(3) XML for testing
const sampleInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns:etd="http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xmlns="http://crd.gov.pl/wzor/2025/02/14/02141/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA(3)" kodPodatku="VAT" rodzajVat="GT" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <CelZlozenia poz="P_7">1</CelZlozenia>
    <DataWytworzeniaJPK>2024-01-15T10:30:00Z</DataWytworzeniaJPK>
    <DataOd>2024-01-01</DataOd>
    <DataDo>2024-01-31</DataDo>
    <NazwaSystemu>System KSeF Test</NazwaSystemu>
  </Naglowek>
  
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>1234567890</NIP>
      <PelnaNazwa>Test Company Sp. z o.o.</PelnaNazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <Wojewodztwo>mazowieckie</Wojewodztwo>
      <Powiat>warszawski</Powiat>
      <Gmina>Warszawa</Gmina>
      <Ulica>ul. Testowa</Ulica>
      <NrDomu>1</NrDomu>
      <KodPocztowy>00-001</KodPocztowy>
      <Poczta>Warszawa</Poczta>
    </Adres>
  </Podmiot1>
  
  <Faktura typ="G">
    <P_1>2024-01-15</P_1>
    <P_2A>FV/2024/001</P_2A>
    <P_3A>
      <NIP>9876543210</NIP>
      <Nazwa>Customer Company Ltd.</Nazwa>
      <Adres>
        <KodKraju>PL</KodKraju>
        <Wojewodztwo>slaskie</Wojewodztwo>
        <Powiat>katowicki</Powiat>
        <Gmina>Katowice</Gmina>
        <Ulica>ul. Klienta</Ulica>
        <NrDomu>10</NrDomu>
        <KodPocztowy>40-001</KodPocztowy>
        <Poczta>Katowice</Poczta>
      </Adres>
    </P_3A>
    <P_6>2024-01-15</P_6>
    <P_13_1>1000.00</P_13_1>
    <P_14_1>230.00</P_14_1>
    <P_15>1230.00</P_15>
    
    <Fa>
      <FaWiersz>
        <NrWierszaFa>1</NrWierszaFa>
        <P_7>Usługi programistyczne</P_7>
        <P_8A>szt</P_8A>
        <P_8B>10</P_8B>
        <P_9A>100.00</P_9A>
        <P_11>1000.00</P_11>
        <P_12>23</P_12>
      </FaWiersz>
    </Fa>
    
    <Stopka>
      <P_16>false</P_16>
      <P_17>false</P_17>
      <P_18>false</P_18>
      <P_18A>false</P_18A>
      <P_19>false</P_19>
      <P_20>false</P_20>
      <P_21>false</P_21>
      <P_22>false</P_22>
      <P_23>false</P_23>
      <P_106E_2>false</P_106E_2>
      <P_106E_3>false</P_106E_3>
      <RodzajFaktury>VAT</RodzajFaktury>
    </Stopka>
  </Faktura>
</Faktura>`;

describe('VisualizationService', () => {
  let service: VisualizationService;

  beforeEach(() => {
    service = new VisualizationService();
  });

  describe('constructor', () => {
    it('should initialize with XSL stylesheet loaded', () => {
      expect(service).toBeInstanceOf(VisualizationService);
      expect(service.getStylesheetInfo()).toEqual({
        version: '2025/06/25/13775',
        source: 'https://crd.gov.pl/wzor/2025/06/25/13775/styl.xsl'
      });
    });
  });

  describe('getSupportedFormats', () => {
    it('should return supported output formats', () => {
      const formats = service.getSupportedFormats();
      expect(formats).toEqual(['html']);
    });
  });

  describe('transformToHtml', () => {
    it('should transform valid FA(3) XML to HTML', async () => {
      const html = await service.transformToHtml(sampleInvoiceXml);
      
      expect(html).toBeDefined();
      expect(typeof html).toBe('string');
      expect(html).toContain('<html');
      expect(html).toContain('e-FAKTURA KSeF');
    });

    it('should generate HTML with default enhanced schema', async () => {
      const html = await service.transformToHtml(sampleInvoiceXml);
      
      // Enhanced schema should include modern HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('viewport');
    });

    it('should handle empty or invalid XML gracefully', async () => {
      // Empty XML should still return some HTML (enhanced template is forgiving)
      const html = await service.transformToHtml('');
      expect(html).toBeDefined();
      expect(html).toContain('<html');
    });
  });

  describe('visualize', () => {
    it('should return HTML visualization with enhanced schema (default)', async () => {
      const request: VisualizationRequest = {
        invoiceXml: sampleInvoiceXml,
        outputFormat: 'html'
      };

      const result = await service.visualize(request);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.contentType).toBe('text/html; charset=utf-8');
      expect(typeof result.data).toBe('string');
      expect(result.schema).toBe('enhanced');
    });

    it('should return HTML visualization with official schema', async () => {
      const request: VisualizationRequest = {
        invoiceXml: sampleInvoiceXml,
        outputFormat: 'html',
        schema: 'official'
      };

      const result = await service.visualize(request);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.contentType).toBe('text/html; charset=utf-8');
      expect(result.schema).toBe('official');
    });

    it('should handle validation errors for missing invoice XML', async () => {
      const request = {
        outputFormat: 'html'
      } as VisualizationRequest;

      const result = await service.visualize(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invoice XML is required');
      expect(result.contentType).toBe('text/plain');
    });

    it('should handle validation errors for empty invoice XML', async () => {
      const request: VisualizationRequest = {
        invoiceXml: '',
        outputFormat: 'html'
      };

      const result = await service.visualize(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invoice XML is required');
      expect(result.contentType).toBe('text/plain');
    });

    it('should validate output format', async () => {
      const request = {
        invoiceXml: sampleInvoiceXml,
        outputFormat: 'pdf' // Not supported
      } as any;

      const result = await service.visualize(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid enum value');
      expect(result.contentType).toBe('text/plain');
    });

    it('should validate schema parameter', async () => {
      const request = {
        invoiceXml: sampleInvoiceXml,
        outputFormat: 'html',
        schema: 'invalid'
      } as any;

      const result = await service.visualize(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid enum value');
    });
  });

  describe('schema selection', () => {
    it('should use enhanced schema by default', async () => {
      const html = await service.transformToHtml(sampleInvoiceXml);
      
      // Enhanced schema characteristics
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('📄 e-FAKTURA KSeF');
    });

    it('should allow explicit schema selection', async () => {
      const options: VisualizationOptions = {
        schema: 'official'
      };

      const html = await service.transformToHtml(sampleInvoiceXml, options);
      
      expect(html).toBeDefined();
      expect(html).toContain('<html');
    });
  });
});

describe('visualizationService singleton', () => {
  it('should be a singleton instance', () => {
    expect(visualizationService).toBeInstanceOf(VisualizationService);
  });

  it('should work with the singleton', async () => {
    const request: VisualizationRequest = {
      invoiceXml: sampleInvoiceXml,
      outputFormat: 'html'
    };

    const result = await visualizationService.visualize(request);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});
