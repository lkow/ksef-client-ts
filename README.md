# KSeF TypeScript Client

A comprehensive TypeScript client library for Poland's national e-invoicing system **KSeF (Krajowy System e-Faktur)**. This package provides a complete integration with KSeF's REST API (version 2.0), supporting authentication, invoice submission, retrieval, and auxiliary operations in a framework-agnostic Node.js library optimized for AWS Lambda.

## Features

- 🔐 **Dual Authentication Support**: Certificate-based and token-based authentication
- 📄 **Invoice Operations**: Submit, retrieve, and query invoices
- 📦 **Batch Processing**: Submit multiple invoices efficiently
- 🎫 **Token Management**: Generate, revoke, and manage authentication tokens
- 👥 **Permissions Management**: Grant and revoke user permissions
- ⚡ **AWS Lambda Optimized**: Lightweight and fast cold starts
- 🔄 **Automatic Retries**: Built-in retry logic for transient failures
- 📊 **Status Polling**: Automatic polling for async operations
- 🛡️ **Type Safety**: Full TypeScript support with comprehensive type definitions
- 🌍 **Multi-Environment**: Support for test, and production environments
- 🎨 **Visualization**: Transform FA(3) invoices to HTML/PDF using official XSL stylesheets
- 🚦 **Rate Limiting**: Built-in rate limiting to comply with API constraints
- 📱 **QR Code Generation**: Generate QR codes for invoices per KSeF specification
- 💾 **Offline Mode**: Generate invoices offline (offline24) and submit later
- 🏢 **Multi-Party Support**: Handle multiple NIP contexts concurrently

## Installation

```bash
npm install @ksef/client
# or
pnpm add @ksef/client
# or
yarn add @ksef/client
```

## Quick Start

### Basic Usage

```typescript
import { KsefClient, createTestClient } from '@ksef/client';

// Create client for test environment
const client = createTestClient(
  {
    // Certificate-based authentication
    certificate: '/path/to/certificate.p12', // or Buffer/base64 string
    password: 'certificate-password'
  },
  {
    type: 'onip', // or 'pesel'
    value: '1234567890' // NIP or PESEL
  }
);

// Authenticate
await client.login();

// Submit an invoice
const result = await client.submitInvoice(invoiceXml);
console.log('Invoice submitted:', result.ksefReferenceNumber);

// Query invoices
const invoices = await client.queryInvoices({
  subjectType: 'subject1',
  dateRange: {
    dateType: 'INVOICE_DATE',
    from: '2024-01-01T00:00:00Z',
    to: '2024-01-31T23:59:59Z'
  }
});

// Cleanup
client.destroy();
```

### Token Management

The client now supports complete token lifecycle management:

```typescript
// Generate a new authorization token
const tokenResponse = await client.auth.generateToken(
  certificateCredentials,
  contextIdentifier,
  'My Application Token'
);

// Check token generation status
const tokenStatus = await client.auth.getTokenGenerationStatus(
  tokenResponse.elementReferenceNumber,
  sessionToken
);

// Query all active tokens
const activeTokens = await client.auth.queryTokens(
  contextIdentifier,
  sessionToken,
  true // Include details
);

// Revoke a token
await client.auth.revokeToken(tokenNumber, sessionToken);
```

For a complete guide on token lifecycle management, see [TOKEN_LIFECYCLE_GUIDE.md](./TOKEN_LIFECYCLE_GUIDE.md).

### Token-Based Authentication

```typescript
import { KsefClient } from '@ksef/client';

const client = new KsefClient({
  environment: 'test',
  credentials: {
    token: 'your-auth-token-here'
  },
  contextIdentifier: {
    type: 'onip',
    value: '1234567890'
  }
});

await client.login();
```

### External Signature Delegation

For secure provider integrations where you don't handle user certificates:

```typescript
import { createTestExternalSigningClient } from '@ksef/client';

const client = createTestExternalSigningClient({
  type: 'nip',
  value: '1234567890'
});

// Generate XML for user to sign
const authData = await client.generateAuthenticationXML();

// User signs the XML with their certificate/EPUAP
const signedXML = await userSignXML(authData.xml);

// Authenticate with signed XML
const session = await client.authenticateWithSignedXML(signedXML);
```

### AWS Lambda Example

```typescript
import { KsefClient } from '@ksef/client';

export const handler = async (event: any) => {
  const client = new KsefClient({
    environment: 'prod',
    credentials: {
      certificate: process.env.KSEF_CERTIFICATE, // base64 encoded
      password: process.env.KSEF_CERT_PASSWORD
    },
    contextIdentifier: {
      type: 'onip',
      value: process.env.KSEF_NIP
    },
    httpOptions: {
      timeout: 30000,
      keepAlive: true
    }
  });

  try {
    await client.login();
    
    const result = await client.submitInvoice(event.invoiceXml, {
      retrieveUpo: true,
      timeout: 60000
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ksefReferenceNumber: result.ksefReferenceNumber,
        status: result.status
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  } finally {
    client.destroy();
  }
};
```

## Configuration

### Client Configuration

```typescript
interface KsefClientConfig {
  environment: 'test' | 'prod' | KsefEnvironmentConfig;
  credentials: CertificateCredentials | TokenCredentials;
  contextIdentifier: ContextIdentifier;
  httpOptions?: HttpClientOptions;
  debug?: boolean;
  sessionOptions?: SessionOptions;
}
```

### Certificate Credentials

```typescript
interface CertificateCredentials {
  certificate: string | Buffer; // Path, PEM content, or P12/PFX data
  password?: string;            // Certificate password if required
  privateKey?: string | Buffer; // Separate private key (for PEM)
  privateKeyPassword?: string;  // Private key password
}
```

### Token Credentials

```typescript
interface TokenCredentials {
  token: string; // Pre-generated authentication token
}
```

## Rate Limiting

The client includes built-in rate limiting to ensure compliance with KSeF API limits:

```typescript
import { KsefClient, DEFAULT_RATE_LIMITS } from '@ksef/client';

const client = new KsefClient({
  environment: 'prod',
  credentials: { token: 'your-token' },
  contextIdentifier: { type: 'onip', value: '1234567890' },
  httpOptions: {
    rateLimitConfig: {
      ...DEFAULT_RATE_LIMITS,
      enabled: true,
      requestsPerMinute: 50,  // Conservative limit
      requestsPerHour: 3000,
      maxConcurrentSessions: 3
    }
  }
});
```

See [API_LIMITS.md](./docs/API_LIMITS.md) for more details.

## QR Code Generation

Generate QR codes for invoices according to KSeF specifications:

```typescript
import { QRCodeService } from '@ksef/client';

const qrService = new QRCodeService('prod');

// Generate QR code for online invoice
const qrCode = await qrService.generateOnlineInvoiceQR({
  ksefReferenceNumber: 'KSeF-ref-12345',
  invoiceNumber: 'FV/2025/001',
  invoiceDate: '2025-01-15',
  sellerIdentifier: { type: 'onip', value: '1234567890' },
  totalAmount: 1230.50,
  currency: 'PLN'
});

// QR code data ready for embedding
console.log(qrCode.data); // Base64 data URL or PNG buffer
```

## Offline Invoice Mode

Generate invoices when KSeF is unavailable and submit them later (offline24 mode):

```typescript
import { OfflineInvoiceService } from '@ksef/client';

const offlineService = new OfflineInvoiceService(
  httpClient,
  baseUrl,
  storage,
  'prod'
);

// Generate offline invoice with QR codes (no API call!)
const offlineInvoice = await offlineService.generateOfflineInvoice(
  invoiceXml,
  qrCodeData,
  { mode: 'offline24' }
);

// Submit within 24 hours
const result = await offlineService.submitOfflineInvoice(
  offlineInvoice.id,
  sessionToken
);
```

**Benefits:**
- Bypass real-time API limits
- Generate invoices immediately
- Batch submission during off-peak hours
- Business continuity when KSeF is down

See [OFFLINE_MODE_GUIDE.md](./docs/OFFLINE_MODE_GUIDE.md) for complete guide.

## Multi-Party Usage

Handle multiple NIP contexts concurrently (perfect for AWS Lambda + SQS):

```typescript
import { createClientForNIP, KsefClientPool } from '@ksef/client';

// Factory pattern: one client per NIP
const client1 = createClientForNIP('1234567890', 'token1');
const client2 = createClientForNIP('0987654321', 'token2');

await client1.login();
await client2.login();

// Each client has independent rate limits
await Promise.all([
  client1.submitInvoice(invoice1),
  client2.submitInvoice(invoice2)
]);

// Or use client pool for many NIPs
const pool = new KsefClientPool();
const client = pool.getClient(nip, token);
```

**Architecture Pattern:**
```
Orchestrator Lambda → SQS Queue → Worker Lambdas (one client per NIP)
```

See [MULTI_PARTY_GUIDE.md](./docs/MULTI_PARTY_GUIDE.md) for AWS Lambda patterns.

## Visualization Service

The KSeF client includes a powerful visualization service that transforms FA(3) XML invoices into HTML and PDF formats using the official Polish government XSL stylesheets.

### Features

- 🎨 **HTML Output**: Transform FA(3) invoices to styled HTML
- 📄 **PDF Generation**: Convert invoices to PDF using Puppeteer
- 🎯 **Official Stylesheets**: Uses government-approved XSL templates
- ⚙️ **Customizable**: Support for custom styling and page options
- 🔍 **Validation**: Built-in XML structure validation

### Basic Usage

```typescript
import { visualizationService } from '@ksef/client';

// Transform to HTML
const htmlResult = await visualizationService.visualize({
  invoiceXml: fa3XmlString,
  outputFormat: 'html'
});

if (htmlResult.success) {
  console.log('HTML generated:', htmlResult.data);
}

// Transform to PDF
const pdfResult = await visualizationService.visualize({
  invoiceXml: fa3XmlString,
  outputFormat: 'pdf',
  pdfOptions: {
    format: 'A4',
    margin: {
      top: '1cm',
      right: '1cm',
      bottom: '1cm',
      left: '1cm'
    },
    printBackground: true
  }
});

if (pdfResult.success) {
  // pdfResult.data is a Buffer containing the PDF
  fs.writeFileSync('invoice.pdf', pdfResult.data);
}
```

### Advanced Usage

```typescript
// Transform with custom options
const html = await visualizationService.transformToHtml(fa3Xml, {
  pageTitle: 'Custom Invoice Title',
  customStyles: `
    .invoice-header { 
      background-color: #f0f0f0; 
      padding: 20px; 
    }
  `
});

// Direct PDF transformation
const pdfBuffer = await visualizationService.transformToPdf(fa3Xml, {
  format: 'A3',
  displayHeaderFooter: true,
  printBackground: false
});
```

### Service Information

```typescript
// Get supported formats
const formats = visualizationService.getSupportedFormats();
// ['html', 'pdf']

// Get stylesheet information
const info = visualizationService.getStylesheetInfo();
// { version: '2025/06/25/13775', source: 'https://crd.gov.pl/wzor/2025/06/25/13775/styl.xsl' }
```

### Error Handling

```typescript
const result = await visualizationService.visualize({
  invoiceXml: invalidXml,
  outputFormat: 'html'
});

if (!result.success) {
  console.error('Visualization failed:', result.error);
}
```

## API Reference

### Authentication

```typescript
// Login with configured credentials
await client.login();

// Check authentication status
const isAuthenticated = client.isAuthenticated();

// Get current session
const session = client.getCurrentSession();

// Logout
await client.logout();
```

### Invoice Operations

```typescript
// Submit single invoice
const result = await client.submitInvoice(invoiceXml, {
  retrieveUpo: true,
  timeout: 60000
});

// Submit multiple invoices
const batchResult = await client.submitInvoicesBatch([xml1, xml2, xml3], {
  batchSize: 10,
  retrieveUpo: false
});

// Get invoice by reference
const invoice = await client.getInvoice('KSeF-reference-number');

// Query invoices
const invoices = await client.queryInvoices({
  subjectType: 'subject1',
  dateRange: {
    dateType: 'INVOICE_DATE',
    from: '2024-01-01T00:00:00Z',
    to: '2024-01-31T23:59:59Z'
  },
  pageSize: 100
});
```

### Token Management

```typescript
// Generate new token
const token = await client.generateAuthToken('My Integration Token');

// Revoke token
await client.revokeAuthToken(tokenNumber);

// Query available tokens
const tokens = await client.queryAuthTokens();
```

### Permissions Management

```typescript
// Grant permissions
await client.grantPermission(
  { type: 'pesel', value: '12345678901' },
  'invoice_write'
);

// Revoke permissions
await client.revokePermission({ type: 'pesel', value: '12345678901' });
```

## Error Handling

The library provides structured error handling with specific error types:

```typescript
import { 
  AuthenticationError, 
  ValidationError, 
  ProcessError,
  KsefApiError 
} from '@ksef/client';

try {
  await client.submitInvoice(invalidXml);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
    // Re-authenticate or check credentials
  } else if (error instanceof ValidationError) {
    console.error('Validation error:', error.message, error.code);
    // Fix the input data
  } else if (error instanceof ProcessError) {
    console.error('Processing error:', error.message, error.referenceNumber);
    // Check operation status or retry
  } else if (error instanceof KsefApiError) {
    console.error('API error:', error.message, error.statusCode);
    // Handle API-specific errors
  }
}
```

## Environment Configuration

### Test Environment
```typescript
const client = new KsefClient({
  environment: 'test', // Uses https://ksef-test.mf.gov.pl/api/v2
  // ... other config
});
```

### Production Environment
```typescript
const client = new KsefClient({
  environment: 'prod', // Uses https://ksef.mf.gov.pl/api/v2
  // ... other config
});
```

### Custom Environment
```typescript
const client = new KsefClient({
  environment: {
    baseUrl: 'https://custom-ksef-instance.com/api/v2',
    name: 'custom'
  },
  // ... other config
});
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Building

```bash
# Clean build directory
npm run clean

# Build the package
npm run build

# Build in watch mode
npm run dev
```

## Requirements

- Node.js 20+
- TypeScript 5.0+ (for development)

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the official KSeF documentation
- Review the API documentation at the KSeF portal

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates. 