# API 2.0 Demo (RC5.7)

> **Note:** This demo targets the test (TE) environment only. Do not use production tokens in `.env.demo`.

This guide walks through an end-to-end flow using the new `KsefApiV2Client`:

1. Token-based authentication
2. Query & grant permissions
3. Open an online session (with AES escrow)
4. Encrypt & send an invoice
5. Poll session/invoice status & download UPO

> **Prerequisites**
>
> - Node.js 20+
> - Valid KSeF token (`/api/v2/tokens` or Portal)
> - Sample invoice XML (`examples/sample-invoice.xml`)
> - `pnpm install` (or npm/yarn)

## 1. Configure environment

Create `.env.demo` (or export via shell):

```
KSEF_V2_ENV=test
KSEF_V2_TOKEN=eyJhbGciOi...
KSEF_V2_NIP=1234567890
KSEF_V2_INVOICE=examples/sample-invoice.xml
```

## 2. Run the demo script

```
pnpm ts-node examples/api2-demo.ts
```

The script will:

- Instantiate `KsefApiV2Client`
- List your own permissions (`/permissions/query/personal/grants`)
- Optionally grant a test permission (skip if lacking `CredentialsManage`)
- Open an online session & encrypt sample invoice
- Submit invoice + close session
- Poll session & invoice status
- Print presigned UPO URL

## 3. Demo script reference

See `examples/api2-demo.ts` for the full flow. Key snippets:

```ts
const client = new KsefApiV2Client({ environment, httpClient });
await client.tokens.generateToken(...); // optional helper

const personalPerms = await client.permissions.queryPersonalPermissions(accessToken, {}, { pageSize: 10 });

const onlineSession = await client.createOnlineSession(accessToken, FORM_FA3);
const encrypted = client.encryptInvoice(invoiceXml, onlineSession.encryptionMaterial, { offlineMode: false });
await client.sendInvoice(accessToken, onlineSession.referenceNumber, encrypted);
await client.closeOnlineSession(accessToken, onlineSession.referenceNumber);

const status = await client.getSessionStatus(accessToken, onlineSession.referenceNumber);
const invoices = await client.listSessionInvoices(accessToken, onlineSession.referenceNumber);
```

## 4. Customizing

- Replace token auth with XAdES by using `authentication.initiateXadesAuthenticationWithCertificate`.
- Use `createBatchSession` + `uploadBatchParts` for high-volume flows.
- Leverage `permissions.grant*` helpers to provision EU/subunit roles during onboarding.

## 5. Next steps

- Wire this demo into automated tests (using TE credentials) to guard regressions.
- Add coverage for batch uploads + offline sessions once TE fixtures are available.
- Extend docs with troubleshooting & rate-limit guidance for API 2.0.
