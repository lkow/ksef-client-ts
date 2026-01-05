# Multi-Party Integrations (API 2.0)

Guidance for SaaS providers and accounting offices that operate on behalf of multiple taxpayers (NIP/PESEL/internal IDs). Based on `auth/sesje.md`, `tokeny-ksef.md`, and `limity/limity-api.md`.

## Key principles

1. **Isolate credentials per context** – store JWTs, refresh tokens, and certificates per tenant. Never reuse sessions across contexts.
2. **Respect rate limits per `(context + IP)`** – throttle each tenant independently (see `docs/API_LIMITS.md`). Use dedicated outbound IP pools if possible.
3. **Trace permissions** – before performing actions on behalf of a client, query `/permissions/query/...` to confirm delegation (personal, entity, subunit).
4. **Monitor auth sessions** – enumerate `/auth/sessions` regularly to revoke stale entries and detect leaked tokens.

## Recommended architecture

| Layer | Responsibilities |
| --- | --- |
| **Command API** | Accepts work (invoice submissions, exports) from frontends/backends, validates tenant status. |
| **Work queue** | Enqueues jobs tagged with `contextIdentifier`, `action`, `payloadReference`. SQS/Kafka/Redis Streams all work. |
| **Worker pool** | One worker per tenant or per few tenants. Each worker owns a `KsefApiV2Client` and refreshes tokens as needed. |
| **Credential vault** | Stores certificate bundles and refresh tokens. Workers request credentials right before use. |
| **Observability** | Emits metrics labelled by tenant (sessions opened, invoices sent, 429s, failures). |

```
┌─────────────┐   enqueue      ┌─────────────┐     lease       ┌───────────────┐
│ Command API │ ─────────────▶ │ Work Queue  │ ──────────────▶ │ Worker (NIP A)│
└─────────────┘                └─────────────┘                 └───────────────┘
                                             ┌───────────────┐
                                             │ Worker (NIP B)│
                                             └───────────────┘
```

## Sample worker skeleton

```ts
import { HttpClient, KsefApiV2Client, ContextIdentifierType } from '@ksef/client';

export class TenantWorker {
  private readonly client: KsefApiV2Client;
  private readonly contextIdentifier = {
    type: ContextIdentifierType.NIP,
    value: this.config.nip
  };

  constructor(private readonly config: { nip: string; env: 'test' | 'prod'; http: HttpClient }) {
    this.client = new KsefApiV2Client({ environment: config.env, httpClient: config.http });
  }

  async run(job: SubmissionJob) {
    const tokens = await this.refreshIfNeeded();
    const session = await this.client.createOnlineSession(tokens.accessToken.token, job.formCode);
    const encrypted = this.client.encryptInvoice(job.invoiceXml, session.encryptionMaterial, job.options);
    await this.client.sendInvoice(tokens.accessToken.token, session.referenceNumber, encrypted);
    await this.client.closeOnlineSession(tokens.accessToken.token, session.referenceNumber);
  }
}
```

## Provisioning permissions at scale

1. **Self-service onboarding** – expose a portal where tenants authenticate with ePUAP or certificate, then delegate permissions to your NIP using `/permissions/persons/grants` or `/permissions/entities/grants`.
2. **Bulk onboarding** – for accounting offices managing hundreds of contexts, pre-build payloads for `/permissions/query/...` to audit what is still missing. Use `continuationToken` headers to page through results.
3. **EU/self-billing** – RC5.x adds new types (`EuEntityAdministration`); the SDK exposes them via `PermissionsV2Service`.

## Tokens & refresh strategy

- Store `accessToken`, `refreshToken`, and their `validUntil` timestamps in your vault.
- Always call `/auth/token/refresh` when `validUntil < now + 5 minutes`.
- If refresh fails (400/401), fall back to the certificate/token init flow; mark the previous tokens as invalid to avoid reuse.

## Working with TE data

When building onboarding flows, use `client.testData` (only available in TE) to create sandbox subjects, grant permissions, and adjust limits:

```ts
await client.testData?.grantPermissions({
  contextIdentifier: { type: ContextIdentifierType.NIP, value: '1111111111' },
  authorizedIdentifier: { type: ContextIdentifierType.NIP, value: '2222222222' },
  permissions: [{ permissionType: 'InvoiceWrite' }]
});
```

## Observability checklist

| Metric | Dimension |
| --- | --- |
| Sessions opened | `contextIdentifier`, `result` |
| Invoice submissions | `contextIdentifier`, `status.code` |
| 4xx/5xx errors | `contextIdentifier`, `endpoint` |
| Rate-limit rejections | `contextIdentifier`, `endpoint`, `Retry-After` |
| Token refresh attempts | `contextIdentifier`, `result` |

## References

- `docs/API_LIMITS.md` – throttle recommendations and presets.
- `docs/CERTIFICATE_GUIDE.md` – authentication flows.
- `docs/OFFLINE_MODE_GUIDE.md` – how to drain offline queues once connectivity is restored.
