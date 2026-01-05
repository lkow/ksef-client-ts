# KSeF API Limits Guide

**Official Documentation**: [limity-api.md](https://github.com/CIRFMF/ksef-docs/blob/main/limity/limity-api.md)  
**Last Updated**: 2025-12-29 (based on documentation dated 12.09.2025)

## Important: Test Environment

⚠️ **Rate limits are DISABLED in the test environment (TE)** and are not currently planned to be enabled.

However, usage parameters are monitored. If degraded performance or excessive load from specific integrations is detected, protective limits may be introduced to maintain stability and equal access for all users.

## Production Environment Limits

### General Rules

#### 1. How Limits are Calculated

All KSeF API requests are subject to limits. Limits are enforced per **pair: (context + IP address)**:

- **Context**: Determined by `ContextIdentifier` (`Nip`, `InternalId`, or `NipVatUe`) provided during authentication
- **IP Address**: The IP address from which the network connection is established

**Example**:  
Accounting office A retrieves invoices on behalf of company B (using B's NIP) from IP1.  
Simultaneously, company B retrieves invoices themselves (their own NIP) from IP2.  
Despite the shared context (NIP), different IP addresses mean limits are calculated independently.

#### 2. Sliding Window Model

Limits use a **sliding/rolling window** model, not fixed windows:

- For `req/h` threshold: counts requests in the **last 60 minutes**
- For `req/min` threshold: counts requests in the **last 60 seconds**
- For `req/s` threshold: counts requests in the **last 1 second**

Windows do NOT reset at `:00` marks. All three thresholds (`req/s`, `req/min`, `req/h`) apply in parallel - **blocking occurs when ANY limit is exceeded**.

#### 3. Dynamic Blocking After Exceeding Limits

When limits are exceeded, the API returns **HTTP 429 Too Many Requests** and temporarily blocks further requests.

The **blocking duration is dynamic** and depends on the frequency and scale of violations. The exact blocking time is returned in the `Retry-After` header (in seconds).

**Example 429 Response**:
```json
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 30

{
  "status": {
    "code": 429,
    "description": "Too Many Requests",
    "details": ["Przekroczono limit 20 żądań na minutę. Spróbuj ponownie po 30 sekundach."]
  }
}
```

#### 4. Violation Logging

All limit violations are logged and analyzed by security mechanisms. The system particularly monitors patterns suggesting attempts to bypass limits, such as systematic use of multiple IP addresses within one context. Such actions may be considered a security threat.

Repeated violations or extreme load may trigger automatic protective measures:
- API access blocking for the entity or IP range
- Limited availability for the most demanding contexts

#### 5. Higher Limits During Night Hours

Between **20:00-06:00**, higher retrieval limits apply than during the day. Exact values will be determined during the initial KSeF 2.0 operation period after tuning parameters to actual load patterns.

## Endpoint-Specific Limits

### Invoice Retrieval

| Endpoint | Description | req/s | req/min | req/h |
|----------|-------------|-------|---------|-------|
| `POST /invoices/query/metadata` | Retrieve invoice metadata list | 8 | 16 | 20 |
| `POST /invoices/exports` | Export invoice package | 4 | 8 | 20 |
| `GET /invoices/ksef/{ksefNumber}` | Retrieve invoice by KSeF number | 8 | 16 | 64 |

**Architectural Notes**:
- API is designed for **synchronization** between central repository and local database
- Business operations (search, filter, reporting) should be performed on **locally synchronized data**
- NOT intended for real-time user operations (viewing individual invoices, querying on demand)

**Recommended Integration**:
1. **Low volume**: Synchronous retrieval via `/invoices/ksef/{ksefNumber}` if within limits
2. **High volume**: Use asynchronous export mechanism (`/invoices/exports`) - queued and doesn't negatively impact performance
3. **Business operations**: Perform on **local database** synchronized with KSeF

**Synchronization Frequency**:
- **Not recommended**: High-frequency schedules (< 15 minutes per entity in production)
- **Low volume profiles**: On-demand retrieval, supplemented with daily cycle in night window
- **Invoice receipt date**: Date KSeF number is assigned (automatic upon processing), independent of retrieval moment

### Invoice Submission

#### Batch Session (Recommended for Multiple Invoices)

| Endpoint | Description | req/s | req/min | req/h |
|----------|-------------|-------|---------|-------|
| `POST /sessions/batch` | Open batch session | 10 | 20 | 120 |
| `POST /sessions/batch/{ref}/close` | Close batch session | 10 | 20 | 120 |
| `PUT /sessions/batch/{ref}/parts/*` | Upload batch parts | **NO LIMIT** | **NO LIMIT** | **NO LIMIT** |

**Key Advantages**:
- Batch treated as single queue message (reference to package vs separate entries per invoice)
- Processed with same priority as single document
- Reduces network and operational overhead:
  - Fewer HTTP requests
  - Batch operations (decryption, validation, writing) most efficient
- Compression highly effective for XML format (similar structure, repeating blocks)
- **Uploading batch parts has NO limits** - parallel/multi-threaded upload recommended for large packages

**Recommended Use Cases**:
- E-commerce: Aggregate invoices and send every 5 minutes in batches
- Subscription services: Generated in bulk daily/monthly
- Automated B2B billing: Aggregated after operation completion

#### Interactive Session (Single Invoices)

| Endpoint | Description | req/s | req/min | req/h |
|----------|-------------|-------|---------|-------|
| `POST /sessions/online` | Open interactive session | 10 | 30 | 120 |
| `POST /sessions/online/{ref}/invoices` | Submit invoice | 10 | 30 | 180 |
| `POST /sessions/online/{ref}/close` | Close interactive session | 10 | 30 | 120 |

**Intended For**:
- Point of sale (POS): Immediate registration after transaction
- Mobile apps/light systems: No queuing or buffering mechanism
- Single/irregular events: Individual corrective invoices

**Note**: If regularly hitting interactive session limits, consider switching to batch mode for better efficiency.

### Session Status

| Endpoint | Description | req/s | req/min | req/h |
|----------|-------------|-------|---------|-------|
| `GET /sessions/{ref}/invoices/{invRef}` | Get invoice status from session | 30 | 120 | 720 |
| `GET /sessions` | Get session list | 5 | 10 | 60 |
| `GET /sessions/{ref}/invoices` | Get session invoices | 10 | 20 | 200 |
| `GET /sessions/{ref}/invoices/failed` | Get failed invoices from session | 10 | 20 | 200 |
| `GET /sessions/*` | Other session endpoints | 10 | 120 | 720 |

### Other Endpoints

Default limits apply to all protected API resources not explicitly listed. Each endpoint has its own limit counter, and its requests don't affect other resources.

Limits apply only to **protected resources**. Public resources like `/auth/challenge` (no authentication required) have separate protection mechanisms - **60 requests per second per IP address**.

## Using Rate Limits in Your Code

### Basic Configuration

```typescript
import {
  HttpClient,
  KsefApiV2Client,
  CONSERVATIVE_RATE_LIMITS,
  ContextIdentifierType
} from '@ksef/client';

const httpClient = new HttpClient({
  rateLimitConfig: {
    ...CONSERVATIVE_RATE_LIMITS,
    enabled: true
  }
});

const client = new KsefApiV2Client({ environment: 'prod', httpClient });
const contextIdentifier = { type: ContextIdentifierType.NIP, value: '1234567890' };
```

### Available Presets

```typescript
import {
  DEFAULT_RATE_LIMITS,
  CONSERVATIVE_RATE_LIMITS,
  AGGRESSIVE_RATE_LIMITS,
  getRateLimitsForEndpoint
} from '@ksef/client';

const limits = getRateLimitsForEndpoint('POST', '/invoices/exports', CONSERVATIVE_RATE_LIMITS);
```

### Handling 429 Errors

```typescript
import { KsefApiError } from '@ksef/client';

try {
  await client.submitInvoice(invoiceXml);
} catch (error) {
  if (error instanceof KsefApiError && error.statusCode === 429) {
    // Server enforced rate limit
    // Retry-After header is automatically parsed and used for retry delay
    console.log('Rate limit exceeded, will retry after waiting');
    // HttpClient handles automatic retry with exponential backoff
  }
}
```

### Multi-Party Processing

When processing for multiple NIPs, each (NIP + IP) pair has independent limits:

```typescript
import { KsefApiV2Client, ContextIdentifierType } from '@ksef/client';

const formCode = { systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' } as const;

async function sendForNip(nip: string, invoiceXml: string) {
  const client = new KsefApiV2Client({ environment: 'prod' });
  const accessToken = process.env[`KSEF_TOKEN_${nip}`]!;
  const session = await client.createOnlineSession(accessToken, formCode);
  const encrypted = client.encryptInvoice(invoiceXml, session.encryptionMaterial, { offlineMode: false });
  await client.sendInvoice(accessToken, session.referenceNumber, encrypted);
}

// Each worker owns its own client + credentials per context
const tenantA = new KsefApiV2Client({ environment: 'prod' });
const tenantB = new KsefApiV2Client({ environment: 'prod' });

// From the same IP, limits are enforced per (contextIdentifier, IP) pair
const contextA = { type: ContextIdentifierType.NIP, value: '1111111111' };
const contextB = { type: ContextIdentifierType.NIP, value: '2222222222' };
```

### Sync with `/api/v2/rate-limits`

RC5.7 exposes a public endpoint that reports the effective quotas. You can fetch it via `client.rateLimits.getEffectiveLimits()` and feed the result to the helper utilities.

```typescript
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

const effective = await client.rateLimits.getEffectiveLimits(accessToken);
const sendConfig = buildRateLimitConfigFromCategory('invoiceSend', effective, baseConfig);
const statusConfig = getRateLimitConfigForEndpoint('GET', '/sessions/{ref}/invoices/{invRef}', {
  baseConfig,
  effectiveLimits: effective
});
```

`buildRateLimitConfigFromCategory` focuses on a single category (e.g., `invoiceSend`), whereas `getRateLimitConfigForEndpoint` mirrors the `method + path` combinations used throughout the SDK (falling back to the `other` bucket if the endpoint is not recognized).

### Serverless/Lambda workers

Each AWS Lambda/SQS worker instance keeps its own outbound IP (per ENI) and its own `HttpClient` state, so there’s no need to coordinate quotas globally:

1. **Cold start:** After obtaining an access token, call `client.rateLimits.getEffectiveLimits()` once, then update the worker’s in-memory `HttpClient` config using the helpers shown above.
2. **Warm executions:** Reuse the cached limits for subsequent messages processed by the same container. Refresh periodically if you expect MF to change quotas during long-running jobs.
3. **429 fallback:** If a request still returns HTTP 429, refresh limits immediately inside that worker (still `client.rateLimits.getEffectiveLimits()`), update the config, honor `Retry-After`, and retry. Other Lambda containers continue operating independently with their own caches.

Because quotas are enforced per `(contextIdentifier, IP)` pair, this per-worker strategy remains aligned with `limity/limity-api.md` while avoiding shared global state.

## Best Practices

### 1. Use Batch Mode for Multiple Invoices

✅ **Do**:
```typescript
// Aggregate invoices, send in batch
const invoices = await aggregateInvoicesForLast5Minutes();
await batchService.submitBatch(invoices);
```

❌ **Don't**:
```typescript
// Send each invoice individually in interactive mode
for (const invoice of invoices) {
  await client.submitInvoice(invoice); // Inefficient for high volume
}
```

### 2. Synchronize to Local Database

✅ **Do**:
```typescript
// Sync periodically (e.g., every 30 minutes)
await syncService.synchronize();

// Query local database for business operations
const results = await localDb.searchInvoices({
  dateFrom: '2025-01-01',
  status: 'PAID'
});
```

❌ **Don't**:
```typescript
// Query KSeF API directly for each user action
const results = await client.queryInvoices({ /* filters */ }); // Too frequent
```

### 3. Respect Night Window Advantages

Schedule bulk operations for **20:00-06:00** when limits are higher:

```typescript
// Schedule synchronization for night hours
const isNightWindow = (hour >= 20 || hour < 6);
if (isNightWindow) {
  // More aggressive sync during night hours
  await fullSynchronization();
}
```

### 4. Handle Violations Gracefully

```typescript
import { RateLimitError } from '@ksef/client';

try {
  await rateLimiter.acquireToken();
  await client.submitInvoice(invoice);
} catch (error) {
  if (error instanceof RateLimitError) {
    // Internal rate limiter prevented request
    await new Promise(resolve => setTimeout(resolve, error.retryAfterMs));
    // Retry
  }
}
```

### 5. Monitor Usage

Track your usage to avoid violations:

```typescript
const limiter = client.getHttpClient().getRateLimiter();
if (limiter) {
  const status = limiter.getStatus();
  console.log(`Requests: ${status.currentRequests}/${status.maxRequests}`);
  console.log(`At limit: ${status.isAtLimit}`);
}
```

## Alternative: Offline Mode

For scenarios where API limits are insufficient or system is unavailable, use **offline24** mode:

```typescript
import { OfflineInvoiceService } from '@ksef/client';

const offlineService = new OfflineInvoiceService(/* ... */);

// Generate invoice with QR codes immediately (no API call)
const offlineInvoice = await offlineService.generateOfflineInvoice(
  invoiceXml,
  qrCodeData,
  {
    mode: 'offline24',
    offlineCertificate: myOfflineCertificate
  }
);

// Submit to KSeF later within 24-hour window
await offlineService.submitOfflineInvoicesBatch(session, {
  batchSize: 100
});
```

See [OFFLINE_MODE_GUIDE.md](./OFFLINE_MODE_GUIDE.md) for details.

## Resources

- [Official KSeF API Limits Documentation](https://github.com/CIRFMF/ksef-docs/blob/main/limity/limity-api.md)
- [Multi-Party Processing Guide](./MULTI_PARTY_GUIDE.md)
- [Offline Mode Guide](./OFFLINE_MODE_GUIDE.md)
