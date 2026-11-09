# Offline Mode & Technical Corrections (API 2.0)

This guide summarizes how to implement offline24 workflows and technical corrections using KSeF API 2.0. It follows `tryby-offline.md`, `offline/korekta-techniczna.md`, and `kody-qr.md` from [`CIRFMF/ksef-docs`](https://github.com/CIRFMF/ksef-docs).

## 1. When to use offline mode

| Scenario | Recommendation |
| --- | --- |
| Temporary connectivity loss (POS/mobile) | Use offline24, generate KOD I/II, store XML locally, send by the end of the next Polish business day. |
| Planned maintenance / bulk generation | Generate invoices offline and submit in batches during the nightly window (20:00–06:00) to leverage higher limits. |
| Technical correction required | Use the dedicated correction flow (RC5.6) to resend corrected payloads while referencing the original document. |

Offline invoices must be encrypted and registered later via the same `/sessions/online` or `/sessions/batch` endpoints—the difference is the `offlineMode` flag (RC5.4) and the QR codes embedded in the document.

## 2. Recommended architecture

1. **Generate invoice XML** (FA(3) or other supported structure) and persist metadata (deadline, QR codes, storage path).
2. **Generate QR codes** using the data described in `kody-qr.md`. Use the QR code service at `src/api2/qr/service.ts` which implements KOD I and KOD II generation per the spec.
3. **Encrypt invoice payload** at creation time so that no plaintext invoice leaves the secure storage. Store the AES key (encrypted via `/security/public-key-certificates`).
4. **Queue submission jobs** (e.g., DynamoDB status table + SQS). When connectivity is restored, open a session and push the cached payloads.
5. **Track deadlines** – offline24 invoices must be registered by the end of the next Polish business day; add watchdogs that alert when `deadlineAt - now < buffer`.

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
| `deadlineAt` tracking | Store the deadline returned by `calculateOfflineDeadline` (including its nullable result) and process FIFO per context to avoid missing SLAs. |
| Watchdogs | Run a scheduled job every 5 minutes to find drafts where `deadlineAt - now < 60 min` and raise alerts. |
| Offline certificate | RC4 introduced dedicated offline certificates. Track two credentials per tenant (interactive + offline) to avoid mixing scopes. |
| UPO polling | After submission, poll `/sessions/{ref}/invoices` until `status.code === 200` and persist `upoDownloadUrl` for audit. |

## 7. References & next steps

- `tryby-offline.md` – canonical offline24 process
- `offline/korekta-techniczna.md` – error handling + correction flow
- `kody-qr.md` – QR payload definition for offline invoices
- `docs/OFFLINE_MODES_ARCHITECTURE.md` – system-level patterns and storage suggestions

Roadmap: add a dedicated Offline Draft manager (persist AES keys + QR metadata) and official QR/PDF helpers once MF finalises the RC6 materials.

## Deadline helper contract

`calculateOfflineDeadline(mode, issueDate, maintenanceWindow?)` uses the invoice issue date
(`P_1`) in `Europe/Warsaw`, not a rolling 24-hour interval. It skips weekends and Polish statutory
holidays, including Easter Monday, Corpus Christi and Christmas Eve from 2025. For `offline`,
it returns the end of the next business day after unavailability ends; for `awaryjny`, the end
of the seventh business day after the outage ends. An unknown outage end throws instead of
inventing a deadline. The caller must supply the actual MF announcement data.

`MaintenanceWindow.mode` can explicitly distinguish `offline`, `awaryjny` and
`awaria_calkowita`. Without it, `planned: true` means scheduled unavailability and `false`
means an outage when extending a deadline. For direct `calculateOfflineDeadline` calls, the
explicit `mode` (or `maintenanceWindow.mode`) selects the rule. Always pass the actual issue
date for an outage calculation, rather than relying on the default current date. An outage announcement can extend an existing deadline only if it overlaps the submission
period. `calculateOfflineDeadline` checks the issue date; when calling
`extendDeadlineForMaintenance` directly, pass that date as its third argument to exclude stale
outages. Scheduled maintenance does not extend offline24 deadlines. Total failure returns `null`, meaning there is no KSeF submission obligation;
`OfflineInvoiceMetadata.submitBy` is nullable, `isOfflineInvoiceExpired(null)` is false and
`getTimeUntilDeadline(null)` is Infinity. This changes the deadline helpers' return type from
`Date` to `Date | null`; callers must handle the no-submission case explicitly.

See [MF offline rules](https://github.com/CIRFMF/ksef-docs/blob/main/tryby-offline.md) and the
[statutory holiday list](https://isap.sejm.gov.pl/isap.nsf/download.xsp/WDU20250000296/O/D20250296.pdf).
This calendar does not add employer-specific substitute days off.
