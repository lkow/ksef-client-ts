# KSeF TypeScript Client (API 2.0 RC5.7)

This repository provides an API v2-only SDK for Poland's e-invoicing platform (**KSeF – Krajowy System e-Faktur**). The client mirrors the official CIRFMF documentation (`RC5.7` changelog) and focuses on the REST/JSON endpoints exposed under `https://api-test.ksef.mf.gov.pl/v2`, `https://api-demo.ksef.mf.gov.pl/v2`, and `https://api.ksef.mf.gov.pl/v2`.

- ✅ JWT authentication (token + XAdES) with refresh helpers
- ✅ Interactive & batch session management with AES-256 encryption helpers
- ✅ Invoice uploads, polling, and UPO downloads
- ✅ Permissions & token lifecycle APIs (entities, EU administration, attachments)
- ✅ Authentication session introspection & revocation
- ✅ Test data utilities (TE-only) and sample flow wired via Vitest
- ✅ Dynamic rate-limit sync helpers for `/api/v2/rate-limits`

## Installation

```bash
pnpm add @ksef/client
# or npm install / yarn add if preferred
```

Node.js 20+ is required (matching the TLS/cipher requirements from MF). The package ships as ESM only.

## Quick start – token based

```typescript
import { KsefApiV2Client, ContextIdentifierType } from '@ksef/client';

const client = new KsefApiV2Client({ environment: 'test' });
const context = { type: ContextIdentifierType.NIP, value: '1234567890' };

// 1) Authenticate with a previously issued token (Portal or /api/v2/tokens)
const authInit = await client.authentication.initiateTokenAuthentication(context, process.env.KSEF_TOKEN);
const operation = await client.authentication.getAuthenticationStatus(authInit.referenceNumber, authInit.authenticationToken.token);
const tokens = await client.authentication.redeemTokens(authInit.authenticationToken.token);

// 2) Open a session + encrypt payload
const formCode = { systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' } as const;
const onlineSession = await client.createOnlineSession(tokens.accessToken.token, formCode);
const encrypted = client.encryptInvoice('<InvoiceXML/>', onlineSession.encryptionMaterial);

// 3) Upload invoice and close the session
const submission = await client.sendInvoice(tokens.accessToken.token, onlineSession.referenceNumber, encrypted);
await client.closeOnlineSession(tokens.accessToken.token, onlineSession.referenceNumber);

// 4) Poll status / download presigned UPO link
const invoices = await client.listSessionInvoices(tokens.accessToken.token, onlineSession.referenceNumber);
console.log(invoices.invoices[0]?.upoDownloadUrl);
```

See `examples/api2-demo.ts` and `tests/api2-demo.test.ts` for a runnable walkthrough against the TE environment. Place credentials inside `.env.demo` (see `docs/API2_DEMO.md`).

## Quick start – certificate (XAdES) flow

```typescript
import { KsefApiV2Client, ContextIdentifierType } from '@ksef/client';

const client = new KsefApiV2Client({ environment: 'prod' });
const authInit = await client.authentication.initiateXadesAuthenticationWithCertificate(
  {
    certificate: fs.readFileSync('cert.p12'),
    password: process.env.KSEF_CERT_PASSWORD
  },
  { type: ContextIdentifierType.NIP, value: '9876543210' }
);
// Continue with getAuthenticationStatus → redeemTokens → refreshAccessToken
```

The helper builds and signs the XML payload specified in [`uwierzytelnianie.md`](https://github.com/CIRFMF/ksef-docs/blob/main/uwierzytelnianie.md#21-uwierzytelnianie-kwalifikowanym-podpisem-elektronicznym).

## Local XAdES diagnostics

The four analytical tools in [`scripts/`](scripts/README.md) help inspect signatures and XML canonicalization. `pnpm xades:auth` sends authentication requests to KSeF; the other tools run locally. See the guide for prerequisites, environment variables, examples, and sensitive-output precautions. These tools are not a complete XAdES validator.

## AuthManager (auto refresh)

`KsefApiV2Client` now exposes a built-in `authManager` that can store access/refresh tokens and refresh access tokens automatically after HTTP 401.

```ts
import { KsefApiV2Client } from '@ksef/client';

const client = new KsefApiV2Client({ environment: 'test' });

// after your auth flow:
client.setAuthenticationTokens({
  accessToken: tokens.accessToken.token,
  refreshToken: tokens.refreshToken.token
});

// helper methods:
await client.refreshAndStoreAccessToken(); // uses stored refresh token
```

## Sessions & encryption

1. Open an online or batch session via `client.sessions.openOnlineSession` / `openBatchSession`.
2. The helper negotiates AES-256 keys using the `SymmetricKeyEncryption` certificate advertised by `/security/public-key-certificates`.
3. Use `encryptInvoice` / `encryptInvoiceCorrection` to build the payload that matches `SendInvoiceRequest`.
4. Upload invoices (`client.invoices.sendInvoice`) or stream parts with `client.batchUploader.uploadPart`.
5. Close the session and poll using `client.sessions.getSessionStatus`, `listSessionInvoices`, `listFailedSessionInvoices`, and UPO helpers.

All hashes and payload sizes follow the RC5.7 base64/SHA-256 rules from `przeglad-kluczowych-zmian-ksef-api-2-0.md`.

## High-level batch workflow

For production batch submission, prefer `client.batch` over manually wiring archive metadata. The high-level workflow keeps persistence outside the SDK while owning the KSeF mechanics: tar.gz archive creation, invoice hash manifest, part splitting before encryption, AES encryption, part upload, polling, pagination, and result correlation by `invoiceHash`.

```ts
const prepared = await client.batch.prepare({
  formCode,
  invoices: [
    { localId: 'invoice-123', fileName: 'invoice-123.xml', xml }
  ]
});

const submitted = await client.batch.submit(accessToken, prepared, {
  uploadConcurrency: 4
});

const finalStatus = await client.batch.waitForCompletion(accessToken, submitted.referenceNumber);
const results = await client.batch.getMappedResults(
  accessToken,
  submitted.referenceNumber,
  prepared.manifest
);
```

The existing `createBatchSession(accessToken, formCode, buffer, ...)` helper remains available as a low-level/advanced API for callers that already own archive construction and part metadata.

## Collective payment identifiers

`client.collectiveIdentifiers` supports the four collective identifier operations in the TR/demo 2.8.0 OpenAPI snapshot. An identifier references existing KSeF invoices from the same seller; generating one does not initiate or confirm a payment. Availability depends on the API version deployed in the selected environment.

```ts
const { collectiveIdentifierNumber } = await client.collectiveIdentifiers.generate(accessToken, {
  invoices: [
    { ksefNumber: firstKsefNumber, payment: { amount: 100, currency: 'PLN' } },
    { ksefNumber: secondKsefNumber, payment: { amount: 45, currency: 'PLN' } }
  ]
});
// Persist collectiveIdentifierNumber with the local payment reference.

const request = { collectiveIdentifierNumbers: [collectiveIdentifierNumber] };
let page = await client.collectiveIdentifiers.queryInvoices(accessToken, request, { pageSize: 500 });
const invoices = [...page.invoices];
while (page.continuationToken) {
  page = await client.collectiveIdentifiers.queryInvoices(accessToken, request, {
    pageSize: 500,
    continuationToken: page.continuationToken
  });
  invoices.push(...page.invoices);
}
```

Use `query(accessToken, { dateCreatedFrom, dateCreatedTo, ...filters }, options)` to list identifiers for the context, or `queryByKsefNumber(accessToken, ksefNumber, options)` to find identifiers containing an invoice. All three reads return one page and accept `{ pageSize, continuationToken }`; the cursor is sent in the `x-continuation-token` header.

- Creation requires at least two invoices from one seller. Read the current maximum from `client.rateLimits.getContextLimits(accessToken)` (`collectiveIdentifier.maxInvoices`, default 500); the SDK leaves server-side validation and dynamic limits to KSeF.
- `queryInvoices` accepts up to ten identifiers and a page size of 10–500. Other queries accept a page size of 10–200; `query` permits a date interval of at most 100 days. The API default page size is 10.
- `payment` and `description` may be absent or null. `detailsHidden: true` means access restrictions hid those values; it does not mean the payment amount is zero.
- One of `InvoiceRead`, `InvoiceWrite`, or `CollectiveIdentifierManage` is required. Person grants and KSeF token permission types support `CollectiveIdentifierManage`.
- `generate` disables transport retries and refresh-on-401 for that request, even when retries are enabled on the shared HTTP client. Supply a valid access token. If a response is lost, creation may have succeeded: reconcile the uncertain result before explicitly trying again. The contract does not promise idempotent creation. Read operations retain the HTTP client's retry policy.

## Permissions, tokens & sessions

- `client.permissions`: covers `/permissions/**` (personal/entity grants, indirect/self-billing, EU administration, attachment consent) and the `/permissions/query/...` endpoints. Pagination matches the `pageOffset + pageSize` semantics described in `api-changelog.md` (RC5.x additions).
- `client.tokens`: wraps `/tokens` CRUD so you can generate, page through, or revoke authentication tokens; statuses mirror `tokeny-ksef.md`.
- Use `KsefApiV2.AuthSessionService` directly when you need to list or revoke `/auth/sessions` entries (`auth/sesje.md` contract).

## Rate limits

Use `client.rateLimits.getEffectiveLimits(accessToken)` to fetch the current quotas advertised by `/api/v2/rate-limits` (same numbers as `limity/limity-api.md`). Helpers exported from `@ksef/client` convert those values into the `RateLimitConfig` shape consumed by the HTTP client.

```ts
import {
  HttpClient,
  KsefApiV2Client,
  DEFAULT_RATE_LIMITS,
  buildRateLimitConfigFromCategory,
  getRateLimitConfigForEndpoint
} from '@ksef/client';

const baseConfig = { ...DEFAULT_RATE_LIMITS, enabled: true };
const httpClient = new HttpClient({ rateLimitConfig: baseConfig });
const client = new KsefApiV2Client({ environment: 'prod', httpClient });
const effectiveLimits = await client.rateLimits.getEffectiveLimits(accessToken);

const invoiceSendConfig = buildRateLimitConfigFromCategory('invoiceSend', effectiveLimits, baseConfig);

const perEndpointConfig = getRateLimitConfigForEndpoint(
  'POST',
  '/sessions/online/{referenceNumber}/invoices',
  { baseConfig, effectiveLimits }
);
```

## Test data utilities (TE only)

`client.testData` is available **only** when the client is instantiated with `environment: 'test'`. It exposes the scaffolding endpoints from [`dane-testowe-scenariusze.md`](https://github.com/CIRFMF/ksef-docs/blob/main/dane-testowe-scenariusze.md):

```typescript
await client.testData?.grantPermissions({ ... });
await client.testData?.createSubject({ ... });
await client.testData?.setSessionLimits(token, { onlineSession: {...}, batchSession: {...} });
```

Each method throws if invoked against production to make the TE-only contract explicit.

## Documentation map

| File | Purpose |
| --- | --- |
| `docs/API2_DEMO.md` | Step-by-step demo (TE token) + `.env.demo` description |
| `docs/API_LIMITS.md` | Summary of `limity/limity-api.md` and how to apply it in client code |
| `docs/CERTIFICATE_GUIDE.md` | Certificate management for API 2.0 (token + XAdES) |
| `docs/MULTI_PARTY_GUIDE.md` | Patterns for multi-tenant integrations using API v2 |
| `docs/OFFLINE_MODE_GUIDE.md` + `docs/OFFLINE_MODES_ARCHITECTURE.md` | Offline/technical correction flows, deadline tracking |
| `docs/TOKEN_LIFECYCLE_GUIDE.md` | Token APIs end-to-end |
| `docs/INTEGRATION_TESTING.md` | Integration testing setup and troubleshooting |

## Running the demo & tests

1. `cp .env.demo.example .env.demo` and fill in `KSEF_V2_TOKEN`, `KSEF_V2_ENV`, `KSEF_V2_NIP`, `KSEF_V2_INVOICE`.
2. `pnpm ts-node examples/api2-demo.ts` – manual demo.
3. `pnpm run test:integration` – runs `tests/api2-demo.test.ts` and autoloads `.env.demo` (skips if token missing).
4. `pnpm lint` – ESLint using `.eslintrc.cjs`.

## References

- [`CIRFMF/ksef-docs`](https://github.com/CIRFMF/ksef-docs): `przeglad-kluczowych-zmian-ksef-api-2-0.md`, `api-changelog.md`, `uwierzytelnianie.md`, `limity/limity-api.md`, `tokeny-ksef.md`, `auth/sesje.md`, `dane-testowe-scenariusze.md`, `tryby-offline.md`, `kody-qr.md`.
- OpenAPI snapshot: `docs/reference/ksef-api-v2-openapi.json` (refresh with `pnpm run update:openapi`; override source with `KSEF_OPENAPI_UPSTREAM_URL`).

Pull requests should link the relevant CIRFMF source (section + date) so we can keep parity with MF releases.
