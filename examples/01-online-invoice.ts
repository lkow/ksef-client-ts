/**
 * Example 01: Online Invoice Flow
 * ================================
 * 
 * This example demonstrates the complete flow for sending an invoice
 * through an online session in KSeF API v2.
 * 
 * Prerequisites:
 * 1. Copy env.examples.template to .env.examples
 * 2. Set KSEF_TOKEN with your access token
 * 3. Set KSEF_NIP with your context NIP
 * 4. Ensure sample-invoice.xml exists (or set KSEF_INVOICE_PATH)
 * 
 * Flow:
 * 1. Create client and online session
 * 2. Encrypt invoice with session material
 * 3. Send encrypted invoice
 * 4. Close session and retrieve status
 */

import {
  getConfig,
  loadInvoiceXml,
  printHeader,
  printStep,
  printSuccess
} from './utils/setup.js';
import {
  KsefApiV2Client,
  ContextIdentifierType,
  type FormCode
} from '../dist/index.js';

// Standard FA(3) form code for Polish e-invoices
const FORM_CODE: FormCode = {
  systemCode: 'FA (3)',
  schemaVersion: '1-0E',
  value: 'FA'
};

async function main() {
  printHeader(
    '📄 Example 01: Online Invoice Flow',
    'Send an invoice through KSeF using an online session.'
  );

  // Step 1: Load configuration (validates prerequisites)
  printStep(1, 6, 'Loading configuration...');
  const config = getConfig();
  const invoiceXml = loadInvoiceXml(config);
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Context NIP: ${config.contextNip}`);
  console.log(`   Invoice size: ${invoiceXml.length} bytes`);

  // Step 2: Create API client
  printStep(2, 6, 'Creating KSeF API v2 client...');
  const client = new KsefApiV2Client({
    environment: config.environment
  });

  // Step 3: Open online session
  printStep(3, 6, 'Opening online session...');
  const session = await client.createOnlineSession(
    config.accessToken,
    FORM_CODE,
    {
      upoVersion: 'upo-v4-3'
    }
  );
  console.log(`   Session reference: ${session.referenceNumber}`);
  console.log(`   Valid until: ${session.validUntil}`);

  try {
    // Step 4: Encrypt invoice
    printStep(4, 6, 'Encrypting invoice...');
    const encrypted = client.encryptInvoice(
      invoiceXml,
      session.encryptionMaterial
    );
    console.log(`   Invoice hash: ${encrypted.invoiceHash}`);
    console.log(`   Encrypted size: ${encrypted.encryptedBody.length} bytes`);

    // Step 5: Send invoice
    printStep(5, 6, 'Sending invoice...');
    const sendResult = await client.sendInvoice(
      config.accessToken,
      session.referenceNumber,
      encrypted
    );
    console.log(`   Invoice reference: ${sendResult.referenceNumber}`);

    // Step 6: Close session and get status
    printStep(6, 6, 'Closing session...');
    await client.closeOnlineSession(
      config.accessToken,
      session.referenceNumber
    );

    // Optional: Check session status
    const status = await client.getSessionStatus(
      config.accessToken,
      session.referenceNumber
    );
    console.log(`   Session status: ${status.status.code} - ${status.status.description}`);
    console.log(`   Invoice count: ${status.invoiceCount ?? 0}`);

    // Optional: List invoices in session
    const invoices = await client.listSessionInvoices(
      config.accessToken,
      session.referenceNumber
    );
    if (invoices.invoices.length > 0) {
      console.log('   Invoices:');
      for (const inv of invoices.invoices) {
        console.log(`     - ${inv.invoiceNumber ?? 'pending'}: ${inv.ksefNumber ?? 'awaiting KSeF number'}`);
      }
    }

    printSuccess('Invoice sent successfully!');

  } catch (error) {
    // Always try to close session on error
    console.error('\n❌ Error during invoice processing:', error);
    console.log('   Attempting to close session...');
    try {
      await client.closeOnlineSession(config.accessToken, session.referenceNumber);
      console.log('   Session closed.');
    } catch {
      console.log('   Failed to close session (may already be closed).');
    }
    process.exit(1);
  }
}

main().catch(console.error);

