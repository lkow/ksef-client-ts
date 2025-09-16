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