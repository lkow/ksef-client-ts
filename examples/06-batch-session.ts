/**
 * Example 06: Batch Session for Multiple Invoices
 * ================================================
 * 
 * This example demonstrates how to use batch sessions to efficiently
 * send multiple invoices in a single upload.
 * 
 * Prerequisites:
 * 1. Copy env.examples.template to .env.examples
 * 2. Set KSEF_TOKEN with your access token
 * 3. Set KSEF_NIP with your context NIP
 * 
 * Batch sessions are ideal for:
 * - Sending large volumes of invoices
 * - Offline invoice submission
 * - Scheduled bulk uploads
 * 
 * Flow:
 * 1. Prepare a ZIP archive with encrypted invoices
 * 2. Open batch session with archive metadata
 * 3. Upload archive parts to presigned URLs
 * 4. Monitor session status for completion
 */

import { createReadStream, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  getConfig,
  printHeader,
  printStep,
  printSuccess,
  getTodayIsoDate
} from './utils/setup.js';
import {
  KsefApiV2Client,
  BatchFileBuilder,
  type FormCode
} from '../dist/index.js';

// Standard FA(3) form code
const FORM_CODE: FormCode = {
  systemCode: 'FA (3)',
  schemaVersion: '1-0E',
  value: 'FA'
};

// Sample invoice generator
function generateSampleInvoice(index: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
    <DataWytworzeniaFa>${new Date().toISOString()}</DataWytworzeniaFa>
  </Naglowek>
  <Fa>
    <P_1>${getTodayIsoDate()}</P_1>
    <P_2>FV-BATCH/2024/${String(index).padStart(4, '0')}</P_2>
    <P_15>${(100 + index * 10).toFixed(2)}</P_15>
  </Fa>
</Faktura>`;
}

async function main() {
  printHeader(
    '📦 Example 06: Batch Session for Multiple Invoices',
    'Upload multiple invoices efficiently using batch sessions.'
  );

  // Step 1: Load configuration
  printStep(1, 6, 'Loading configuration...');
  const config = getConfig();
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Context NIP: ${config.contextNip}`);

  // Step 2: Create API client
  printStep(2, 6, 'Creating KSeF API v2 client...');
  const client = new KsefApiV2Client({
    environment: config.environment
  });

  // Step 3: Prepare batch content
  printStep(3, 6, 'Preparing batch content...');
  
  // In a real scenario, you would:
  // 1. Collect invoices from your system
  // 2. Create encrypted XML for each invoice
  // 3. Package them into a ZIP archive
  
  const invoiceCount = 5;
  console.log(`   Generating ${invoiceCount} sample invoices...`);
  
  const invoices: string[] = [];
  for (let i = 1; i <= invoiceCount; i++) {
    invoices.push(generateSampleInvoice(i));
  }
  
  console.log(`   Generated ${invoices.length} invoices`);
  
  // Note: For a real implementation, you would create a proper ZIP archive
  // containing encrypted invoice files. Here we demonstrate the concept.
  
  console.log('\n   📋 Real batch workflow would:');
  console.log('   1. Encrypt each invoice with session symmetric key');
  console.log('   2. Create ZIP archive with encrypted files');
  console.log('   3. Split into parts if > 5MB');
  console.log('   4. Calculate hash for each part');

  // Step 4: Demonstrate batch session creation
  printStep(4, 6, 'Batch session demonstration...');
  
  console.log('\n   📋 To create a batch session:');
  console.log('');
  console.log('   // Create ZIP buffer from your invoices');
  console.log('   const zipBuffer = await createBatchZip(invoices, encryptionKey);');
  console.log('');
  console.log('   // Open batch session - automatically splits large files');
  console.log('   const { session, batchParts } = await client.createBatchSession(');
  console.log('     accessToken,');
  console.log('     formCode,');
  console.log('     zipBuffer');
  console.log('   );');
  console.log('');
  console.log('   console.log("Session ref:", session.referenceNumber);');
  console.log('   console.log("Parts to upload:", session.partUploadRequests.length);');

  // Step 5: Demonstrate part upload
  printStep(5, 6, 'Part upload demonstration...');
  
  console.log('\n   📋 To upload batch parts:');
  console.log('');
  console.log('   // Upload each part to its presigned URL');
  console.log('   await client.uploadBatchParts(');
  console.log('     session.partUploadRequests,');
  console.log('     batchParts');
  console.log('   );');
  console.log('');
  console.log('   // Or manually upload each part:');
  console.log('   for (let i = 0; i < session.partUploadRequests.length; i++) {');
  console.log('     const request = session.partUploadRequests[i];');
  console.log('     const part = batchParts[i];');
  console.log('');
  console.log('     await fetch(request.url, {');
  console.log('       method: request.method,');
  console.log('       headers: request.headers,');
  console.log('       body: part');
  console.log('     });');
  console.log('   }');

  // Step 6: Demonstrate status monitoring
  printStep(6, 6, 'Status monitoring demonstration...');
  
  console.log('\n   📋 To monitor batch session:');
  console.log('');
  console.log('   // Poll for status');
  console.log('   let status;');
  console.log('   do {');
  console.log('     await sleep(5000); // Wait 5 seconds');
  console.log('     status = await client.getSessionStatus(accessToken, sessionRef);');
  console.log('     console.log(`Status: ${status.status.description}`);');
  console.log('     console.log(`Processed: ${status.successfulInvoiceCount}/${status.invoiceCount}`);');
  console.log('   } while (status.status.code < 200);');
  console.log('');
  console.log('   // List invoice results');
  console.log('   const invoices = await client.listSessionInvoices(accessToken, sessionRef);');
  console.log('   for (const inv of invoices.invoices) {');
  console.log('     console.log(`${inv.invoiceNumber}: ${inv.ksefNumber || "pending"}`);');
  console.log('   }');

  printSuccess('Batch session demonstration completed!');

  // =============================================
  // BATCH SESSION REFERENCE
  // =============================================
  
  console.log('\n📋 Batch Session Reference:');
  console.log('');
  console.log('   📦 File Requirements:');
  console.log('   • ZIP archive with encrypted invoice XMLs');
  console.log('   • Max 5MB per part (auto-split by BatchFileBuilder)');
  console.log('   • SHA-256 hash required for each part');
  console.log('');
  console.log('   🔄 Session Lifecycle:');
  console.log('   1. Open session → Get presigned upload URLs');
  console.log('   2. Upload parts → PUT/POST to presigned URLs');
  console.log('   3. Processing → KSeF validates and processes');
  console.log('   4. Complete → Download UPO, get KSeF numbers');
  console.log('');
  console.log('   ⏱️ Timing:');
  console.log('   • Session valid for: 24 hours');
  console.log('   • Processing time: depends on volume');
  console.log('   • Poll interval: 5-10 seconds recommended');
  console.log('');
  console.log('   📊 Rate Limits:');
  console.log('   • POST /sessions/batch: 10/sec, 50/min, 300/hour');
  console.log('   • File upload: 100/sec, 600/min per part');
  console.log('');
  console.log('   💡 Best Practices:');
  console.log('   • Use batch sessions for 10+ invoices');
  console.log('   • Handle partial failures gracefully');
  console.log('   • Retry failed parts with exponential backoff');
  console.log('   • Store session reference for status recovery');
}

main().catch(console.error);

