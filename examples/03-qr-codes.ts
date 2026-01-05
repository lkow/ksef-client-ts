/**
 * Example 03: QR Code Generation
 * ================================
 * 
 * This example demonstrates how to generate KSeF QR codes:
 * - KOD I: Invoice verification QR code
 * - KOD II: Certificate verification QR code with digital signature
 * 
 * Prerequisites:
 * - None! This example generates test certificates locally.
 * - For production, you would use real certificates from a qualified provider.
 * 
 * Output:
 * - Prints QR code URLs to console
 * - Shows signature details for KOD II
 */

import {
  generateTestOfflineCertificate,
  printHeader,
  printStep,
  printSuccess,
  getTodayIsoDate
} from './utils/setup.js';
import {
  QRCodeService,
  CertificateType,
  type InvoiceQRCodeData
} from '../dist/index.js';

// Sample invoice XML for demonstration
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
    '📱 Example 03: QR Code Generation',
    'Generate KSeF verification QR codes for invoices and certificates.'
  );

  // Create QR code service for test environment
  const qrService = new QRCodeService('test');

  // =============================================
  // PART 1: KOD I - Invoice Verification QR Code
  // =============================================
  
  printStep(1, 4, 'Generating KOD I for an online invoice...');
  
  const invoiceDate = getTodayIsoDate();
  
  // Create sample invoice XML
  const onlineInvoiceXml = createSampleInvoiceXml('FV/2024/001', invoiceDate);
  
  // Example: Online invoice (already submitted to KSeF)
  const onlineInvoiceData: InvoiceQRCodeData = {
    invoiceXml: onlineInvoiceXml,
    invoiceDate: invoiceDate,
    sellerNip: '1234567890',
    ksefReferenceNumber: '1234567890-20240115-ABC123DEF456-78',
    isOffline: false
  };

  const kod1Online = await qrService.generateKod1(onlineInvoiceData);
  console.log('\n   📄 Online Invoice QR Code:');
  console.log(`   URL: ${kod1Online.url}`);
  console.log(`   Label: ${kod1Online.label}`);
  console.log(`   QR Format: ${kod1Online.qrCode.format}`);

  // Example: Offline invoice (issued during system unavailability)
  printStep(2, 4, 'Generating KOD I for an offline invoice...');
  
  const offlineInvoiceXml = createSampleInvoiceXml('FV-OFFLINE/2024/001', invoiceDate);
  
  const offlineInvoiceData: InvoiceQRCodeData = {
    invoiceXml: offlineInvoiceXml,
    invoiceDate: invoiceDate,
    sellerNip: '1234567890',
    isOffline: true
  };

  const kod1Offline = await qrService.generateKod1(offlineInvoiceData);
  console.log('\n   📄 Offline Invoice QR Code:');
  console.log(`   URL: ${kod1Offline.url}`);
  console.log(`   Label: ${kod1Offline.label}`);
  console.log(`   ⚠️  Note: Offline invoices use "OFFLINE" as label instead of KSeF reference`);

  // =============================================
  // PART 2: KOD II - Certificate Verification QR
  // =============================================
  
  printStep(3, 4, 'Generating test certificate for KOD II...');
  
  // Generate a test certificate (in production, use real certificates!)
  const testCert = generateTestOfflineCertificate();
  console.log(`   Certificate serial: ${testCert.serialNumber}`);
  console.log(`   Certificate type: ${testCert.type}`);

  printStep(4, 4, 'Generating KOD II with RSA-PSS signature...');
  
  // KOD II requires the same invoice data plus the offline certificate
  const kod2 = await qrService.generateKod2(offlineInvoiceData, testCert);

  console.log('\n   🔐 Certificate Verification QR Code:');
  console.log(`   URL: ${kod2.url.substring(0, 100)}...`);
  console.log(`   Label: ${kod2.label}`);
  console.log(`   Certificate serial: ${kod2.certificateSerialNumber}`);

  // Generate complete invoice QR codes set
  console.log('\n   📦 Complete Invoice QR Codes Set:');
  const completeQRCodes = await qrService.generateInvoiceQRCodes(
    offlineInvoiceData,
    testCert
  );
  console.log(`   KOD I label: ${completeQRCodes.kod1.label}`);
  console.log(`   KOD II present: ${completeQRCodes.kod2 ? 'Yes' : 'No'}`);

  printSuccess('QR codes generated successfully!');

  // =============================================
  // USAGE NOTES
  // =============================================
  
  console.log('\n📋 Usage Notes:');
  console.log('');
  console.log('   KOD I (Invoice QR):');
  console.log('   • Print on every invoice (required by law)');
  console.log('   • Allows recipients to verify invoice authenticity');
  console.log('   • Contains: seller NIP, date, invoice hash');
  console.log('');
  console.log('   KOD II (Certificate QR):');
  console.log('   • Used for offline invoice authorization');
  console.log('   • Contains digital signature for verification');
  console.log('   • Algorithms: RSA-PSS (2048-bit) or ECDSA P-256');
  console.log('');
  console.log('   🔗 Verification URLs:');
  console.log('   • Test: https://qr-test.ksef.mf.gov.pl/...');
  console.log('   • Prod: https://qr.ksef.mf.gov.pl/...');
}

main().catch(console.error);
