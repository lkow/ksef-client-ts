/**
 * Integration Tests for KSeF Client
 * 
 * These tests run against the official KSeF test environment.
 * They work with the actual KsefClient API methods.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { KsefClient } from '../src/client.js';
import { Status, SubjectType, DateType } from '../src/types/invoice.js';
import { RoleType } from '../src/types/permissions.js';
import type { 
  CertificateCredentials,
  QueryInvoiceRequest,
  UpoResponse
} from '../src/types/index.js';
import fs from 'fs/promises';

// Test configuration
const TEST_CONFIG = {
  environment: 'test' as const,
  certPath: process.env.KSEF_TEST_CERT_PATH,
  certPassword: process.env.KSEF_TEST_CERT_PASSWORD,
  testNip: process.env.KSEF_TEST_NIP,
  testPesel: process.env.KSEF_TEST_PESEL,
  timeout: 60000
};

// Sample invoice template - FA(3) compliant based on official samples
const SAMPLE_INVOICE_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns:etd="http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xmlns="http://crd.gov.pl/wzor/2025/02/14/02141/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaFa>{{DATE}}</DataWytworzeniaFa>
    <SystemInfo>KSeF TypeScript Integration Test</SystemInfo>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>{{SELLER_NIP}}</NIP>
      <Nazwa>Test Company Ltd</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>ul. Testowa 1</AdresL1>
      <AdresL2>00-001 Warszawa</AdresL2>
    </Adres>
    <DaneKontaktowe>
      <Email>test@company.pl</Email>
      <Telefon>123456789</Telefon>
    </DaneKontaktowe>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>1234567890</NIP>
      <Nazwa>Test Buyer Company</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>ul. Kupiecka 2</AdresL1>
      <AdresL2>00-002 Kraków</AdresL2>
    </Adres>
    <DaneKontaktowe>
      <Email>buyer@test.pl</Email>
      <Telefon>987654321</Telefon>
    </DaneKontaktowe>
  </Podmiot2>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>{{DATE}}</P_1>
    <P_1M>Warszawa</P_1M>
    <P_2>{{INVOICE_NUMBER}}</P_2>
    <P_6>{{DATE}}</P_6>
    <P_13_1>1000.00</P_13_1>
    <P_14_1>230.00</P_14_1>
    <P_15>1230.00</P_15>
    <Adnotacje>
      <P_16>2</P_16>
      <P_17>2</P_17>
      <P_18>2</P_18>
      <P_18A>2</P_18A>
      <Zwolnienie>
        <P_19N>1</P_19N>
      </Zwolnienie>
      <NoweSrodkiTransportu>
        <P_22N>1</P_22N>
      </NoweSrodkiTransportu>
      <P_23>2</P_23>
      <PMarzy>
        <P_PMarzyN>1</P_PMarzyN>
      </PMarzy>
    </Adnotacje>
    <RodzajFaktury>VAT</RodzajFaktury>
    <FP>1</FP>
    <FaWiersz>
      <NrWierszaFa>1</NrWierszaFa>
      <P_7>Test Product</P_7>
      <P_8A>szt.</P_8A>
      <P_8B>1.00</P_8B>
      <P_9A>1000.00</P_9A>
      <P_11>1000.00</P_11>
      <P_12>23</P_12>
    </FaWiersz>
  </Fa>
  <Stopka>
    <Informacje>
      <StopkaFaktury>Test invoice footer</StopkaFaktury>
    </Informacje>
    <Rejestry>
      <KRS>0000012345</KRS>
      <REGON>123456789</REGON>
      <BDO>000012345</BDO>
    </Rejestry>
  </Stopka>
</Faktura>`;

describe('KSeF Integration Tests', () => {
  let client: KsefClient;
  let certificateCredentials: CertificateCredentials;
  let testInvoiceReferences: string[] = [];

  const skipIfMissingConfig = () => {
    if (!TEST_CONFIG.certPath || !TEST_CONFIG.testNip) {
      console.warn('⚠️  Skipping integration tests - missing configuration');
      console.warn('Required: KSEF_TEST_CERT_PATH, KSEF_TEST_NIP');
      return true;
    }
    return false;
  };

  const generateTestInvoice = (invoiceNumber?: string): string => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const invoiceNum = invoiceNumber || `TEST-INV-${Date.now()}`;
    
    return SAMPLE_INVOICE_TEMPLATE
      .replace(/{{DATE}}/g, dateStr)
      .replace(/{{SELLER_NIP}}/g, TEST_CONFIG.testNip!)
      .replace(/{{INVOICE_NUMBER}}/g, invoiceNum);
  };

  beforeAll(async () => {
    if (skipIfMissingConfig()) return;

    try {
      const certBuffer = await fs.readFile(TEST_CONFIG.certPath!);
      certificateCredentials = {
        certificate: certBuffer,
        password: TEST_CONFIG.certPassword
      };

      client = new KsefClient({
        environment: TEST_CONFIG.environment,
        credentials: certificateCredentials,
        contextIdentifier: {
          type: 'onip',
          value: TEST_CONFIG.testNip!
        },
        debug: true
      });

      console.log(`✅ Integration tests initialized for NIP: ${TEST_CONFIG.testNip}`);
    } catch (error) {
      console.error('❌ Failed to initialize integration tests:', error);
      throw error;
    }
  }, TEST_CONFIG.timeout);

  afterAll(async () => {
    if (skipIfMissingConfig()) return;

    try {
      if (client && client.isAuthenticated()) {
        await client.logout();
      }
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error);
    }
  }, TEST_CONFIG.timeout);

  describe('Authentication', () => {
    it('should authenticate using configured credentials', async () => {
      if (skipIfMissingConfig()) return;

      const result = await client.login();
      
      expect(result).toBeDefined();
      expect(result.token).toBeTypeOf('string');
      expect(result.context.contextIdentifier.value).toBe(TEST_CONFIG.testNip);
      expect(client.isAuthenticated()).toBe(true);
      
      console.log(`✅ Authentication successful`);
    }, TEST_CONFIG.timeout);

    it('should authenticate with custom credentials', async () => {
      if (skipIfMissingConfig()) return;

      if (client.isAuthenticated()) {
        await client.logout();
      }

      const result = await client.authenticate(certificateCredentials);
      
      expect(result).toBeDefined();
      expect(result.token).toBeTypeOf('string');
      expect(result.context.contextIdentifier.value).toBe(TEST_CONFIG.testNip);
      
      console.log(`✅ Custom authentication successful`);
    }, TEST_CONFIG.timeout);
  });

  describe('Invoice Operations', () => {
    it('should submit and retrieve invoice', async () => {
      if (skipIfMissingConfig()) return;

      const testInvoice = generateTestInvoice();
      
      // Submit invoice
      const submitResult = await client.submitInvoice(testInvoice);
      
      expect(submitResult).toBeDefined();
      expect(submitResult.ksefReferenceNumber).toBeTypeOf('string');
      expect(submitResult.status).toBe(Status.ACCEPTED);
      
      testInvoiceReferences.push(submitResult.ksefReferenceNumber);
      console.log(`✅ Invoice submitted: ${submitResult.ksefReferenceNumber}`);
      
      // Retrieve invoice
      const retrievedInvoice = await client.getInvoice(submitResult.ksefReferenceNumber);
      
      expect(retrievedInvoice).toBeDefined();
      expect(retrievedInvoice.invoiceMetadata.ksefNumber).toBe(submitResult.ksefReferenceNumber);
      
      console.log(`✅ Invoice retrieved successfully`);
    }, TEST_CONFIG.timeout);

    it('should get UPO for invoice', async () => {
      if (skipIfMissingConfig() || testInvoiceReferences.length === 0) return;

      const ksefReference = testInvoiceReferences[0];
      let upoData: UpoResponse | null = null;
      let attempts = 0;
      const maxAttempts = 5;
      
      // UPO might not be immediately available
      while (attempts < maxAttempts && !upoData) {
        try {
          upoData = await client.getUpo(ksefReference);
          break;
        } catch (error) {
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`⏳ UPO not ready, waiting... (${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      if (upoData) {
        expect(upoData.upo).toBeInstanceOf(Uint8Array);
        expect(upoData.upo.length).toBeGreaterThan(0);
        console.log(`✅ UPO retrieved (${upoData.upo.length} bytes)`);
      } else {
        console.log(`⚠️  UPO not available after ${maxAttempts} attempts`);
      }
    }, TEST_CONFIG.timeout);
  });

  describe('Query Operations', () => {
    it('should query invoices', async () => {
      if (skipIfMissingConfig()) return;

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      const queryRequest: QueryInvoiceRequest = {
        subjectType: SubjectType.SUBJECT1,
        dateRange: {
          dateType: DateType.ACQUISITION_DATE,
          from: startDate.toISOString().split('T')[0],
          to: endDate.toISOString().split('T')[0]
        },
        pageSize: 10,
        pageOffset: 0
      };

      const result = await client.queryInvoices(queryRequest);
      
      expect(result).toBeDefined();
      expect(result.invoiceMetadataList).toBeInstanceOf(Array);
      expect(result.totalElements).toBeTypeOf('number');
      
      console.log(`✅ Query returned ${result.totalElements} invoices`);
    }, TEST_CONFIG.timeout);
  });

  describe('Batch Operations', () => {
    it('should submit invoices in batch', async () => {
      if (skipIfMissingConfig()) return;

      const invoiceCount = 2;
      const testInvoices: string[] = [];
      
      for (let i = 0; i < invoiceCount; i++) {
        testInvoices.push(generateTestInvoice(`BATCH-${Date.now()}-${i + 1}`));
      }
      
      const batchResult = await client.submitInvoicesBatch(testInvoices);
      
      expect(batchResult).toBeDefined();
      expect(batchResult.totalCount).toBe(invoiceCount);
      expect(batchResult.successCount).toBeGreaterThan(0);
      expect(batchResult.results).toHaveLength(invoiceCount);
      
      for (const result of batchResult.results) {
        expect(result.ksefReferenceNumber).toBeTypeOf('string');
        testInvoiceReferences.push(result.ksefReferenceNumber);
      }
      
      console.log(`✅ Batch completed: ${batchResult.successCount}/${batchResult.totalCount} successful`);
    }, TEST_CONFIG.timeout * 2);
  });

  describe('Permissions', () => {
    it('should query permissions', async () => {
      if (skipIfMissingConfig()) return;

      const permissions = await client.queryPermissions(
        { type: 'onip', value: TEST_CONFIG.testNip! }
      );
      
      expect(permissions).toBeDefined();
      expect(permissions.permissions).toBeInstanceOf(Array);
      
      console.log(`✅ Permissions queried: ${permissions.permissions.length} entries`);
    }, TEST_CONFIG.timeout);
  });

  describe('Complete E2E Workflow', () => {
    it('should perform full invoice lifecycle', async () => {
      if (skipIfMissingConfig()) return;

      console.log('🚀 Starting E2E workflow...');
      
      // 1. Ensure authentication
      if (!client.isAuthenticated()) {
        await client.login();
      }
      expect(client.isAuthenticated()).toBe(true);
      console.log('✅ Step 1: Authenticated');
      
      // 2. Submit invoice
      const testInvoice = generateTestInvoice(`E2E-${Date.now()}`);
      const submitResult = await client.submitInvoice(testInvoice);
      expect(submitResult.status).toBe(Status.ACCEPTED);
      console.log(`✅ Step 2: Invoice submitted (${submitResult.ksefReferenceNumber})`);
      
      // 3. Retrieve invoice
      const retrievedInvoice = await client.getInvoice(submitResult.ksefReferenceNumber);
      expect(retrievedInvoice.invoiceMetadata.ksefNumber).toBe(submitResult.ksefReferenceNumber);
      console.log('✅ Step 3: Invoice retrieved');
      
      // 4. Query invoices
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      
      const queryRequest: QueryInvoiceRequest = {
        subjectType: SubjectType.SUBJECT1,
        dateRange: {
          dateType: DateType.ACQUISITION_DATE,
          from: startDate.toISOString().split('T')[0],
          to: endDate.toISOString().split('T')[0]
        },
        pageSize: 100,
        pageOffset: 0
      };
      
      const queryResult = await client.queryInvoices(queryRequest);
      expect(queryResult.invoiceMetadataList).toBeInstanceOf(Array);
      console.log(`✅ Step 4: Query completed (${queryResult.totalElements} invoices)`);
      
      // 5. Logout
      await client.logout();
      expect(client.isAuthenticated()).toBe(false);
      console.log('✅ Step 5: Logged out');
      
      console.log('🎉 E2E workflow completed successfully!');
    }, TEST_CONFIG.timeout * 3);
  });
});

export { TEST_CONFIG }; 