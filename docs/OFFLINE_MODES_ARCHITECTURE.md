# Offline Mode Architecture Patterns (API 2.0)

The goal is to keep business operations running when KSeF is unavailable (planned maintenance, connectivity issues) while staying compliant with the `offline24` rules described in [`tryby-offline.md`](https://github.com/CIRFMF/ksef-docs/blob/main/tryby-offline.md).

## Building blocks

1. **Draft store** – persists invoice XML, encrypted payload, AES material, QR codes, and deadlines. Recommended backends: DynamoDB, PostgreSQL, MongoDB.
2. **Inbox queue** – each invoice enters a queue once generated (SQS/Kafka). Messages contain tenant/context, invoice ID, and desired submission mode.
3. **Scheduler** – moves ready drafts into "submission" queues based on priority (deadline, invoice type).
4. **Submitter workers** – instantiate `KsefApiV2Client`, open sessions, and send encrypted payloads. One worker per context keeps rate limits predictable.
5. **Monitor** – polls `/sessions/{ref}` & `/sessions/{ref}/invoices` to update statuses, download UPO URLs, and escalate failures.

## Reference flow

```
┌────────────┐     ┌───────────────┐     ┌──────────────┐
│ Offline UI │ ──▶ │ Draft Storage │ ──▶ │ Scheduler    │
└────────────┘     └───────────────┘     └─────┬────────┘
                                                │ ready-to-send batch
                                           ┌─────▼──────┐
                                           │ Workers   │  open session → send → close
                                           └─────┬──────┘
                                                 │ status
                                           ┌─────▼──────┐
                                           │ Monitor   │  polls + stores UPO links
                                           └────────────┘
```

## Implementation tips

### Draft storage schema

| Field | Purpose |
| --- | --- |
| `invoiceId` | Business identifier (e.g., `FV/12/2025`). |
| `contextIdentifier` | `{ type: 'Nip', value: '1234567890' }`. |
| `encryptedInvoice` | Output of `client.encryptInvoice(..., { offlineMode: true })`. |
| `encryptionMaterial` | AES key + IV (wrapped with MF’s public key). Store encrypted at rest via KMS. |
| `deadlineAt` | `issuedAt + 24h`. |
| `status` | `Draft`, `Queued`, `Submitted`, `Failed`, `Expired`. |
| `upoReference` | Populated once `/sessions/{ref}/invoices` returns success. |

### Worker behaviour

- Instantiate `new KsefApiV2Client({ environment, httpClient })` per worker.
- Use `client.createBatchSession` for large queues (compression saves bandwidth); flag `offlineMode` when invoking `encryptInvoice`.
- Apply rate limits per context (see `docs/API_LIMITS.md`). Distinguish offline vs interactive traffic to avoid saturating the same IP.
- If KSeF is still unreachable, leave drafts untouched so the watchdog can continue to escalate.

### Monitoring & alerts

- Schedule a Lambda/cron to find drafts where `deadlineAt - now <= 2h` and alert operations.
- When status `21180` occurs, requeue as "technical correction" and capture MF’s `status.details` for manual review.
- Store every UPO download URL (`upoDownloadUrl`, `upoDownloadUrlExpirationDate`) to prove compliance.

### Test environment utilities

Use `client.testData` helpers to spin up synthetic contexts in TE:

```ts
await client.testData?.createSubject({
  subjectNip: '1111111111',
  subjectType: 'Business',
  description: 'Offline test context'
});
await client.testData?.grantPermissions({ ... });
```

These endpoints are guarded so they throw automatically outside TE.

## Roadmap alignment

- RC5.7 emphasises dedicated offline certificates—plan credential storage accordingly.
- RC6 will expand technical correction payloads; keep draft schema flexible for additional hashes/flags.
