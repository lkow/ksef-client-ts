import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { KsefApiV2Client } from '../src/api2/client.js';

dotenv.config({ path: path.resolve(__dirname, '../.env.demo') });

const TOKEN = process.env.KSEF_V2_TOKEN;
const ENV = process.env.KSEF_V2_ENV === 'prod' ? 'prod' : 'test';
const FORM_CODE = {
  systemCode: 'FA (3)',
  schemaVersion: '1-0E',
  value: 'FA'
} as const;

describe.skipIf(!TOKEN)('API v2 demo flow', () => {
  const invoicePath = process.env.KSEF_V2_INVOICE || path.resolve(__dirname, '../examples/sample-invoice.xml');
  const invoiceXml = fs.readFileSync(invoicePath, 'utf8');
  const client = new KsefApiV2Client({ environment: ENV });

  let sessionRef: string | undefined;

  beforeAll(() => {
    expect(TOKEN).toBeDefined();
  });

  it('runs the demo flow', async () => {
    const personal = await client.permissions.queryPersonalPermissions(TOKEN!, {}, { pageSize: 5 });
    expect(personal).toBeDefined();

    const session = await client.createOnlineSession(TOKEN!, FORM_CODE);
    sessionRef = session.referenceNumber;

    const encrypted = client.encryptInvoice(invoiceXml, session.encryptionMaterial);
    const sendResult = await client.sendInvoice(TOKEN!, session.referenceNumber, encrypted);
    expect(sendResult.referenceNumber).toBeTruthy();

    await client.closeOnlineSession(TOKEN!, session.referenceNumber);

    const status = await client.getSessionStatus(TOKEN!, session.referenceNumber);
    expect(status.status).toBeDefined();

    const invoices = await client.listSessionInvoices(TOKEN!, session.referenceNumber);
    expect(Array.isArray(invoices.invoices)).toBe(true);
  }, 120_000);
});
