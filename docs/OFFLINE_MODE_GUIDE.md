# Offline Mode & Technical Corrections (API 2.0)

This guide summarizes how to implement offline24 workflows and technical corrections using KSeF API 2.0. It follows `tryby-offline.md`, `offline/korekta-techniczna.md`, and `kody-qr.md` from [`CIRFMF/ksef-docs`](https://github.com/CIRFMF/ksef-docs).

## 1. When to use offline mode

| Scenario | Recommendation |
| --- | --- |
| Temporary connectivity loss (POS/mobile) | Use offline24, generate KOD I/II, store XML locally, send within 24h. |
| Planned maintenance / bulk generation | Generate invoices offline and submit in batches during the nightly window (20:00–06:00) to leverage higher limits. |
| Technical correction required | Use the dedicated correction flow (RC5.6) to resend corrected payloads while referencing the original document. |

Offline invoices must be encrypted and registered later via the same `/sessions/online` or `/sessions/batch` endpoints—the difference is the `offlineMode` flag (RC5.4) and the QR codes embedded in the document.

## 2. Recommended architecture

1. **Generate invoice XML** (FA(3) or other supported structure) and persist metadata (deadline, QR codes, storage path).
2. **Generate QR codes** using the data described in `kody-qr.md`. Use the QR code service at `src/api2/qr/service.ts` which implements KOD I and KOD II generation per the spec.
3. **Encrypt invoice payload** at creation time so that no plaintext invoice leaves the secure storage. Store the AES key (encrypted via `/security/public-key-certificates`).
4. **Queue submission jobs** (e.g., DynamoDB status table + SQS). When connectivity is restored, open a session and push the cached payloads.
5. **Track deadlines** – every offline invoice must be registered within 24 hours; add watchdogs that alert when `deadlineAt - now < buffer`.

## 3. Creating an offline invoice payload

```ts
import { KsefApiV2Client, ContextIdentifierType } from '@ksef/client';
import fs from 'node:fs';

const client = new KsefApiV2Client({ environment: 'prod' });
const formCode = { systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' } as const;
const xml = fs.readFileSync('offline-invoice.xml', 'utf8');

// Pre-negotiate AES key material (store encrypted key + IV alongside the invoice)
const onlineSession = await client.createOnlineSession(accessToken, formCode);
const encryptedPayload = client.encryptInvoice(xml, onlineSession.encryptionMaterial, {
  offlineMode: true
});

saveOfflineDraft({
  invoiceId,
  encryptedPayload,
  referenceNumber: onlineSession.referenceNumber,
  deadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
});
```

Notes:
- The AES key must remain private until the invoice is registered. Persist the `encryptionMaterial` securely (KMS/Secrets Manager).
- If you generate invoices through other channels, create a helper that negotiates AES keys without immediately sending to `/sessions/online` (coming in a future SDK revision).

## 4. Submitting cached invoices

```ts
const draft = await loadOfflineDraft(invoiceId);
const status = await client.sendInvoice(accessToken, draft.referenceNumber, draft.encryptedPayload);
await client.closeOnlineSession(accessToken, draft.referenceNumber);
markDraftAsSent(invoiceId, status.referenceNumber);
```

If the API returns status codes `21180` or `550`, inspect `status.details` and follow the correction guidance from `offline/korekta-techniczna.md`.

## 5. Technical correction helper

When resubmitting a corrected invoice, compute hashes for both the current and the corrected XML.

```ts
const encrypted = client.encryptInvoiceCorrection(
  correctedInvoiceXml,
  originalInvoiceXml,
  draft.encryptionMaterial,
  { offlineMode: true }
);
```

The helper fills `hashOfCorrectedInvoice` so KSeF can link the documents per RC5.6.

## 6. Deadline & monitoring tips

| Control | Description |
| --- | --- |
| `deadlineAt` tracking | Store `deadlineAt = issuedAt + 24h` and process FIFO per context to avoid missing SLAs. |
| Watchdogs | Run a scheduled job every 5 minutes to find drafts where `deadlineAt - now < 60 min` and raise alerts. |
| Offline certificate | RC4 introduced dedicated offline certificates. Track two credentials per tenant (interactive + offline) to avoid mixing scopes. |
| UPO polling | After submission, poll `/sessions/{ref}/invoices` until `status.code === 200` and persist `upoDownloadUrl` for audit. |

## 7. References & next steps

- `tryby-offline.md` – canonical offline24 process
- `offline/korekta-techniczna.md` – error handling + correction flow
- `kody-qr.md` – QR payload definition for offline invoices
- `docs/OFFLINE_MODES_ARCHITECTURE.md` – system-level patterns and storage suggestions

Roadmap: add a dedicated Offline Draft manager (persist AES keys + QR metadata) and official QR/PDF helpers once MF finalises the RC6 materials.
