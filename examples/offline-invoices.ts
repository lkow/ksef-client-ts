/**
 * Offline Invoice Examples
 * 
 * Demonstrates generating and submitting offline invoices using offline24 mode
 */

import {
  OfflineInvoiceService,
  QRCodeService,
  KsefClient,
  createHttpClient,
  InMemoryOfflineInvoiceStorage
} from '../src/index.js';
import type { OfflineInvoiceInputData, OfflineInvoiceMetadata } from '../src/types/offline.js';

// ============================================================================
// BASIC OFFLINE INVOICE GENERATION
// ============================================================================

/**
 * Example 1: Generate a single offline invoice with QR codes
 */
export async function generateOfflineInvoice() {
  console.log('=== Generating Offline Invoice ===\n');

  // Create offline invoice service
  const httpClient = createHttpClient();
  const offlineService = new OfflineInvoiceService(
    httpClient,
    'https://ksef-test.mf.gov.pl/api/v2',
    undefined, // Use default in-memory storage
    'test',
    true // debug mode
  );

  // Prepare invoice XML (FA(3) format)
  const invoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2025/02/14/02141/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA(3)" wersjaSchemy="1-0">FA</KodFormularza>
    <DataWytworzeniaFa>2025-01-15T10:30:00Z</DataWytworzeniaFa>
    <SystemInfo>KSeF TypeScript Client</SystemInfo>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>1234567890</NIP>
      <Nazwa>Example Seller Ltd</Nazwa>
    </DaneIdentyfikacyjne>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>0987654321</NIP>
      <Nazwa>Example Buyer Ltd</Nazwa>
    </DaneIdentyfikacyjne>
  </Podmiot2>
  <Fa>
    <P_1>2025-01-15</P_1>
    <P_2>FV/2025/001</P_2>
    <P_13_1>1000.00</P_13_1>
    <P_14_1>230.00</P_14_1>
    <P_15>1230.00</P_15>
  </Fa>
</Faktura>`;

  // Prepare invoice metadata
  const invoiceData: OfflineInvoiceInputData = {
    invoiceNumber: 'FV/2025/001',
    invoiceDate: '2025-01-15',
    sellerIdentifier: {
      type: 'onip',
      value: '1234567890'
    },
    buyerIdentifier: {
      type: 'onip',
      value: '0987654321'
    },
    totalAmount: 1230.00,
    currency: 'PLN'
  };

  // Generate offline invoice
  const offlineInvoice = await offlineService.generateOfflineInvoice(
    invoiceXml,
    invoiceData,
    {
      mode: 'offline24',
      generateQRCodes: true,
      qrCodeOptions: {
        format: 'dataurl',
        width: 256
      }
    }
  );

  console.log('Offline invoice generated successfully!');
  console.log('Invoice ID:', offlineInvoice.id);
  console.log('Invoice Number:', offlineInvoice.invoiceNumber);
  console.log('Generated at:', offlineInvoice.generatedAt);
  console.log('Submit by:', offlineInvoice.submitBy);
  console.log('Status:', offlineInvoice.status);
  console.log('\nQR Codes generated:');
  console.log('- KOD I (Invoice):', offlineInvoice.qrCodes.kod1.qrCode.format);
  console.log('- KOD II (Certificate):', offlineInvoice.qrCodes.kod2?.qrCode.format || 'Not generated');

  return offlineInvoice;
}

// ============================================================================
// BULK OFFLINE INVOICE GENERATION
// ============================================================================

/**
 * Example 2: Generate multiple offline invoices (bypass API limits)
 */
export async function generateBulkOfflineInvoices() {
  console.log('\n=== Generating Bulk Offline Invoices ===\n');

  const httpClient = createHttpClient();
  const offlineService = new OfflineInvoiceService(
    httpClient,
    'https://ksef-test.mf.gov.pl/api/v2',
    new InMemoryOfflineInvoiceStorage(),
    'test'
  );

  const invoices: OfflineInvoiceMetadata[] = [];

  // Generate 100 invoices quickly (no API calls!)
  for (let i = 1; i <= 100; i++) {
    const invoiceNumber = `FV/2025/${String(i).padStart(4, '0')}`;
    const amount = 1000 + (i * 10);
    
    const invoiceXml = generateInvoiceXML(invoiceNumber, i);
    
    const invoiceData: OfflineInvoiceInputData = {
      invoiceNumber,
      invoiceDate: '2025-01-15',
      sellerIdentifier: { type: 'onip', value: '1234567890' },
      buyerIdentifier: { type: 'onip', value: '0987654321' },
      totalAmount: amount,
      currency: 'PLN'
    };

    const offlineInvoice = await offlineService.generateOfflineInvoice(
      invoiceXml,
      invoiceData,
      { mode: 'offline24' }
    );

    invoices.push(offlineInvoice);

    if (i % 10 === 0) {
      console.log(`Generated ${i}/100 invoices...`);
    }
  }

  console.log(`\nSuccessfully generated ${invoices.length} offline invoices!`);
  console.log('All invoices can be submitted to KSeF within 24 hours.');

  return invoices;
}

// ============================================================================
// SUBMIT OFFLINE INVOICES
// ============================================================================

/**
 * Example 3: Submit offline invoices to KSeF
 */
export async function submitOfflineInvoices() {
  console.log('\n=== Submitting Offline Invoices ===\n');

  // First, generate some offline invoices
  const storage = new InMemoryOfflineInvoiceStorage();
  const httpClient = createHttpClient();
  
  const offlineService = new OfflineInvoiceService(
    httpClient,
    'https://ksef-test.mf.gov.pl/api/v2',
    storage,
    'test',
    true
  );

  // Generate a few invoices
  for (let i = 1; i <= 5; i++) {
    const invoiceNumber = `FV/2025/${String(i).padStart(4, '0')}`;
    const xml = generateInvoiceXML(invoiceNumber, i);
    await offlineService.generateOfflineInvoice(
      xml,
      {
        invoiceXml: xml,
        invoiceDate: '2025-01-15',
        sellerNip: '1234567890',
        isOffline: true
      }
    );
  }

  console.log('Generated 5 offline invoices for testing\n');

  // Create KSeF client
  const client = new KsefClient({
    environment: 'test',
    credentials: {
      token: process.env.KSEF_TOKEN || 'test-token'
    },
    contextIdentifier: { type: 'onip', value: '1234567890' }
  });

  await client.login();
  const session = client.getCurrentSession();

  if (!session) {
    throw new Error('Failed to get session');
  }

  // Submit all offline invoices in batch
  const batchResult = await offlineService.submitOfflineInvoicesBatch(
    session,
    {
      batchSize: 10,
      continueOnError: true
    }
  );

  console.log('\nBatch submission completed:');
  console.log('- Total:', batchResult.total);
  console.log('- Submitted:', batchResult.submitted);
  console.log('- Accepted:', batchResult.accepted);
  console.log('- Failed:', batchResult.failed);
  console.log('- Expired:', batchResult.expired);

  await client.logout();

  return batchResult;
}

// ============================================================================
// MONITOR OFFLINE INVOICES
// ============================================================================

/**
 * Example 4: Monitor and manage offline invoices
 */
export async function monitorOfflineInvoices() {
  console.log('\n=== Monitoring Offline Invoices ===\n');

  const storage = new InMemoryOfflineInvoiceStorage();
  const httpClient = createHttpClient();
  const offlineService = new OfflineInvoiceService(
    httpClient,
    'https://ksef-test.mf.gov.pl/api/v2',
    storage,
    'test'
  );

  // Generate some test invoices with different deadlines
  for (let i = 1; i <= 10; i++) {
    const xml = generateInvoiceXML(`FV/2025/${i}`, i);
    await offlineService.generateOfflineInvoice(
      xml,
      {
        invoiceXml: xml,
        invoiceDate: '2025-01-15',
        sellerNip: '1234567890',
        isOffline: true
      }
    );
  }

  // List all offline invoices
  const allInvoices = await offlineService.listOfflineInvoices();
  console.log(`Total offline invoices: ${allInvoices.length}\n`);

  // Get invoices expiring soon (within 2 hours)
  const expiringSoon = await offlineService.getExpiringSoon(2);
  console.log(`Invoices expiring within 2 hours: ${expiringSoon.length}`);

  if (expiringSoon.length > 0) {
    console.log('\nUrgent invoices to submit:');
    expiringSoon.forEach(inv => {
      const timeRemaining = new Date(inv.submitBy).getTime() - Date.now();
      const hoursRemaining = (timeRemaining / (1000 * 60 * 60)).toFixed(1);
      console.log(`- ${inv.invoiceNumber}: ${hoursRemaining} hours remaining`);
    });
  }

  // List by status
  const pending = await offlineService.listOfflineInvoices({
    status: ['GENERATED', 'QUEUED']
  });
  console.log(`\nPending submission: ${pending.length} invoices`);

  return {
    total: allInvoices.length,
    expiringSoon: expiringSoon.length,
    pending: pending.length
  };
}

// ============================================================================
// INTEGRATE WITH PDF GENERATION
// ============================================================================

/**
 * Example 5: Generate offline invoice with embedded QR codes in PDF
 */
export async function generateOfflineInvoiceWithPDF() {
  console.log('\n=== Generating Offline Invoice with PDF ===\n');

  const httpClient = createHttpClient();
  const offlineService = new OfflineInvoiceService(
    httpClient,
    'https://ksef-test.mf.gov.pl/api/v2',
    undefined,
    'test'
  );

  // Generate offline invoice
  const invoiceXml = generateInvoiceXML('FV/2025/001', 1);
  const offlineInvoice = await offlineService.generateOfflineInvoice(
    invoiceXml,
    {
      invoiceXml,
      invoiceDate: '2025-01-15',
      sellerNip: '1234567890',
      isOffline: true
    },
    {
      qrCodeOptions: {
        format: 'dataurl', // Base64 data URL for easy embedding
        width: 200
      }
    }
  );

  console.log('Offline invoice generated');
  console.log('QR codes ready for PDF embedding:');
  console.log(`- KOD I (Invoice QR length): ${offlineInvoice.qrCodes.kod1.qrCode.data.length} chars`);
  console.log(`- KOD II (Certificate QR length): ${offlineInvoice.qrCodes.kod2?.qrCode.data.length || 'N/A'} chars`);

  // In a real scenario, you would:
  // 1. Use visualization service to generate HTML
  // 2. Inject QR codes into HTML
  // 3. Convert to PDF
  // 
  // Example HTML injection:
  const htmlWithQR = `
    <div class="invoice-qr-codes">
      <div class="kod1-qr">
        <h4>${offlineInvoice.qrCodes.kod1.label}</h4>
        <img src="${offlineInvoice.qrCodes.kod1.qrCode.data}" alt="KOD I - Invoice Verification" />
      </div>
      ${offlineInvoice.qrCodes.kod2 ? `
      <div class="kod2-qr">
        <h4>${offlineInvoice.qrCodes.kod2.label}</h4>
        <img src="${offlineInvoice.qrCodes.kod2.qrCode.data}" alt="KOD II - Certificate Verification" />
      </div>
      ` : ''}
    </div>
  `;

  console.log('\nQR codes can be embedded in HTML and converted to PDF');
  console.log('Customer can scan codes to verify invoice authenticity');

  return offlineInvoice;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate sample invoice XML
 */
function generateInvoiceXML(invoiceNumber: string, index: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2025/02/14/02141/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA(3)" wersjaSchemy="1-0">FA</KodFormularza>
    <DataWytworzeniaFa>2025-01-15T10:30:00Z</DataWytworzeniaFa>
    <SystemInfo>KSeF TypeScript Client - Offline Example</SystemInfo>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>1234567890</NIP>
      <Nazwa>Example Seller Ltd</Nazwa>
    </DaneIdentyfikacyjne>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>0987654321</NIP>
      <Nazwa>Example Buyer Ltd</Nazwa>
    </DaneIdentyfikacyjne>
  </Podmiot2>
  <Fa>
    <P_1>2025-01-15</P_1>
    <P_2>${invoiceNumber}</P_2>
    <P_13_1>${1000 + index}.00</P_13_1>
    <P_14_1>${(1000 + index) * 0.23}.00</P_14_1>
    <P_15>${(1000 + index) * 1.23}.00</P_15>
  </Fa>
</Faktura>`;
}

// ============================================================================
// RUN EXAMPLES
// ============================================================================

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     KSeF Offline Invoice Examples                     ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // Example 1: Single invoice
    await generateOfflineInvoice();

    // Example 2: Bulk generation
    await generateBulkOfflineInvoices();

    // Example 3: Submit invoices (requires valid credentials)
    // await submitOfflineInvoices();

    // Example 4: Monitor invoices
    await monitorOfflineInvoices();

    // Example 5: PDF integration
    await generateOfflineInvoiceWithPDF();

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║     All Examples Completed Successfully!              ║');
    console.log('╚════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n❌ Error running examples:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}

