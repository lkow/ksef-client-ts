import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { KsefApiV2Client } from '../src/api2/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../.env.demo') });

const ENV = process.env.KSEF_V2_ENV === 'prod' ? 'prod' : 'test';
const ACCESS_TOKEN = process.env.KSEF_V2_TOKEN;
const CONTEXT_NIP = process.env.KSEF_V2_NIP;
const INVOICE_PATH = process.env.KSEF_V2_INVOICE || path.resolve(__dirname, './sample-invoice.xml');

if (!ACCESS_TOKEN || !CONTEXT_NIP) {
  throw new Error('Set KSEF_V2_TOKEN and KSEF_V2_NIP in .env.demo');
}

const client = new KsefApiV2Client({ environment: ENV });

async function runDemo(): Promise<void> {
  console.log(`Running API v2 demo (${ENV})...`);

  const formCode = {
    systemCode: 'FA (3)',
    schemaVersion: '1-0E',
    value: 'FA'
  } as const;

  const invoiceXml = fs.readFileSync(INVOICE_PATH, 'utf8');

  console.log('Listing personal permissions...');
  const personal = await client.permissions.queryPersonalPermissions(ACCESS_TOKEN, {}, { pageSize: 10 });
  console.log('Permissions:', personal.permissions.length);

  console.log('Opening online session...');
  const onlineSession = await client.createOnlineSession(ACCESS_TOKEN, formCode);
  console.log('Session ref:', onlineSession.referenceNumber);

  const encryptedInvoice = client.encryptInvoice(invoiceXml, onlineSession.encryptionMaterial, { offlineMode: false });
  console.log('Encrypted invoice size:', encryptedInvoice.encryptedInvoiceSize);

  console.log('Sending invoice...');
  const sendResult = await client.sendInvoice(
    ACCESS_TOKEN,
    onlineSession.referenceNumber,
    encryptedInvoice
  );
  console.log('Invoice reference:', sendResult.referenceNumber);

  console.log('Closing session...');
  await client.closeOnlineSession(ACCESS_TOKEN, onlineSession.referenceNumber);

  console.log('Polling session status...');
  const status = await client.getSessionStatus(ACCESS_TOKEN, onlineSession.referenceNumber);
  console.log('Status:', status.status);

  console.log('Listing session invoices...');
  const invoices = await client.listSessionInvoices(ACCESS_TOKEN, onlineSession.referenceNumber);
  console.log('Invoices in session:', invoices.invoices.length);

  if (invoices.invoices.length > 0) {
    const first = invoices.invoices[0];
    console.log('First invoice status:', first.status);
    if (first.upoDownloadUrl) {
      console.log('UPO download URL:', first.upoDownloadUrl);
    }
  }

  console.log('Demo complete.');
}

runDemo().catch((error) => {
  console.error('Demo failed:', error);
  process.exitCode = 1;
});
