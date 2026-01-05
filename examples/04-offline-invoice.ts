/**
 * Example 04: Offline Invoice Management
 * =======================================
 * 
 * This example demonstrates the complete offline invoice workflow:
 * 1. Generate an offline invoice with QR codes (KOD I + KOD II)
 * 2. Store it locally with proper metadata
 * 3. Track submission deadlines
 * 4. Submit when KSeF becomes available
 * 
 * Prerequisites:
 * - For LOCAL demo: None! Uses test certificates.
 * - For REAL submission: Set KSEF_TOKEN, KSEF_NIP in .env.examples
 * 
 * Offline Modes:
 * - offline24: Planned offline (24h deadline)
 * - offline: System unavailability (extended deadline)
 * - awaryjny: Emergency mode
 * - awaria_calkowita: Total system failure
 */

import { randomUUID } from 'node:crypto';
import {
  generateTestOfflineCertificate,
  printHeader,
  printStep,
  printSuccess,
  getTodayIsoDate
} from './utils/setup.js';
import {
  QRCodeService,
  ContextIdentifierType,
  InMemoryOfflineInvoiceStorage,
  calculateOfflineDeadline,
  getDefaultOfflineReason,
  isOfflineInvoiceExpired,
  getTimeUntilDeadline,
  OfflineInvoiceStatus,
  type OfflineInvoiceMetadata,
  type OfflineMode,
  type InvoiceQRCodeData
} from '../dist/index.js';

// Sample invoice XML generator
function createSampleInvoiceXml(invoiceNumber: string, issueDateIso: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
    <DataWytworzeniaFa>${new Date().toISOString()}</DataWytworzeniaFa>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>1234567890</NIP>
      <Nazwa>Demo Seller Sp. z o.o.</Nazwa>
    </DaneIdentyfikacyjne>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>0987654321</NIP>
      <Nazwa>Demo Buyer S.A.</Nazwa>
    </DaneIdentyfikacyjne>
  </Podmiot2>
  <Fa>
    <P_1>${issueDateIso}</P_1>
    <P_2>${invoiceNumber}</P_2>
    <P_15>1230.00</P_15>
  </Fa>
</Faktura>`;
}

async function main() {
  printHeader(
    '📴 Example 04: Offline Invoice Management',
    'Generate, store, and manage offline invoices with proper QR codes.'
  );

  // Initialize services
  const qrService = new QRCodeService('test');
  const storage = new InMemoryOfflineInvoiceStorage();

  // Generate test certificate (in production, use a real certificate!)
  const testCert = generateTestOfflineCertificate();

  // =============================================
  // STEP 1: Generate Offline Invoice
  // =============================================
  
  printStep(1, 5, 'Generating offline invoice metadata...');
  
  const invoiceNumber = 'FV-OFFLINE/2024/001';
  const invoiceDate = getTodayIsoDate();
  const offlineMode: OfflineMode = 'offline24';  // Planned offline
  const generatedAt = new Date();

  // Create invoice XML
  const invoiceXml = createSampleInvoiceXml(invoiceNumber, invoiceDate);

  // Calculate deadline based on mode
  const deadline = calculateOfflineDeadline(offlineMode, generatedAt);
  console.log(`   Mode: ${offlineMode}`);
  console.log(`   Reason: ${getDefaultOfflineReason(offlineMode)}`);
  console.log(`   Submit by: ${deadline.toISOString()}`);
  
  const timeRemaining = getTimeUntilDeadline(deadline);
  const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
  console.log(`   Time remaining: ${hoursRemaining} hours`);

  // =============================================
  // STEP 2: Generate QR Codes
  // =============================================
  
  printStep(2, 5, 'Generating QR codes (KOD I + KOD II)...');
  
  // Invoice data for QR code
  const invoiceData: InvoiceQRCodeData = {
    invoiceXml,
    invoiceDate,
    sellerNip: '1234567890',
    isOffline: true
  };

  // Generate complete QR code set (KOD I + KOD II)
  const qrCodes = await qrService.generateInvoiceQRCodes(invoiceData, testCert);
  
  console.log(`   KOD I generated: ${qrCodes.kod1.label}`);
  console.log(`   KOD I URL: ${qrCodes.kod1.url.substring(0, 80)}...`);
  console.log(`   KOD II generated: ${qrCodes.kod2?.label ?? 'N/A'}`);

  // =============================================
  // STEP 3: Create and Store Offline Invoice
  // =============================================
  
  printStep(3, 5, 'Storing offline invoice...');
  
  const offlineInvoice: OfflineInvoiceMetadata = {
    id: randomUUID(),
    mode: offlineMode,
    reason: getDefaultOfflineReason(offlineMode),
    invoiceNumber,
    invoiceXml,
    sellerIdentifier: {
      type: ContextIdentifierType.NIP,
      value: '1234567890'
    },
    buyerIdentifier: {
      type: ContextIdentifierType.NIP,
      value: '0987654321'
    },
    qrCodes: {
      kod1: {
        url: qrCodes.kod1.url,
        label: qrCodes.kod1.label,
        hash: ''  // Would be extracted from URL
      },
      kod2: qrCodes.kod2 ? {
        url: qrCodes.kod2.url,
        signature: ''  // Would be extracted from URL
      } : undefined
    },
    generatedAt: generatedAt.toISOString(),
    submitBy: deadline.toISOString(),
    status: OfflineInvoiceStatus.GENERATED
  };

  await storage.save(offlineInvoice);
  console.log(`   Invoice stored with ID: ${offlineInvoice.id.substring(0, 8)}...`);
  console.log(`   Status: ${offlineInvoice.status}`);

  // =============================================
  // STEP 4: List Pending Invoices
  // =============================================
  
  printStep(4, 5, 'Listing pending offline invoices...');
  
  // List invoices ready for submission
  const pendingInvoices = await storage.list({
    status: [OfflineInvoiceStatus.GENERATED, OfflineInvoiceStatus.QUEUED]
  });

  console.log(`   Found ${pendingInvoices.length} pending invoice(s):`);
  for (const inv of pendingInvoices) {
    const expired = isOfflineInvoiceExpired(inv.submitBy);
    const statusIcon = expired ? '⚠️' : '✓';
    console.log(`   ${statusIcon} ${inv.invoiceNumber} - Submit by: ${inv.submitBy}`);
  }

  // =============================================
  // STEP 5: Demo: Queue for Submission
  // =============================================
  
  printStep(5, 5, 'Queueing invoice for submission...');
  
  await storage.update(offlineInvoice.id, {
    status: OfflineInvoiceStatus.QUEUED
  });
  
  const updated = await storage.get(offlineInvoice.id);
  console.log(`   Updated status: ${updated?.status}`);

  printSuccess('Offline invoice workflow demo completed!');

  // =============================================
  // USAGE NOTES
  // =============================================
  
  console.log('\n📋 Offline Invoice Workflow:');
  console.log('');
  console.log('   1. GENERATE: Create invoice XML with offline QR codes');
  console.log('      - KOD I: Invoice verification (always required)');
  console.log('      - KOD II: Certificate signature (for offline invoices)');
  console.log('');
  console.log('   2. STORE: Save locally with deadline tracking');
  console.log('      - Track generation time and mode');
  console.log('      - Calculate submission deadline');
  console.log('');
  console.log('   3. DELIVER: Send invoice to recipient (email, print, etc.)');
  console.log('      - Include QR codes on printed/PDF invoice');
  console.log('');
  console.log('   4. SUBMIT: Send to KSeF when system is available');
  console.log('      - Use batch session for multiple invoices');
  console.log('      - Update stored invoice with KSeF reference');
  console.log('');
  console.log('   📅 Deadlines by Mode:');
  console.log('      - offline24: 24 hours from generation');
  console.log('      - offline: Extended based on maintenance window');
  console.log('      - awaryjny: Emergency, extended deadlines');
  console.log('      - awaria_calkowita: Total failure, longest extension');
  console.log('');
  console.log('   🔐 Certificate Requirements:');
  console.log('      - Use "Offline" type certificate (NOT "Authentication")');
  console.log('      - RSA-PSS (2048-bit) or ECDSA P-256 supported');
  console.log('      - Get from qualified certificate provider');
}

main().catch(console.error);
