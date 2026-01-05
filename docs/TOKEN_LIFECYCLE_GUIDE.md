# KSeF Token Lifecycle Guide

This guide explains the complete token lifecycle in the KSeF (Krajowy System e-Faktur) TypeScript client, including all authentication methods and token management operations.

## 🔑 Token Types Overview

The KSeF system uses several types of tokens:

1. **KSeF Authorization Token** - Reusable token for session initiation
2. **Session Token** - Temporary token for API operations
3. **Certificate-based Authentication** - Direct certificate authentication

## 📋 Complete Token Lifecycle

### Phase 1: Initial Setup (Certificate Authentication)

```typescript
import { KSeFClient } from '@ksef/client';

const client = new KSeFClient({
  environment: 'test', // or 'production'
  debug: true
});

// Step 1: Authenticate with certificate to get session
const sessionToken = await client.auth.authenticate({
  certificate: 'your-certificate-data',
  password: 'certificate-password'
}, {
  type: 'onip',
  value: '1234567890' // Your NIP
});
```

### Phase 2: Generate Authorization Token (One-time)

```typescript
// Step 2: Generate a reusable authorization token
const tokenResponse = await client.auth.generateToken(
  {
    certificate: 'your-certificate-data',
    password: 'certificate-password'
  },
  {
    type: 'onip',
    value: '1234567890'
  },
  'My Application Token' // Optional description
);

console.log('Token Reference:', tokenResponse.elementReferenceNumber);

// Step 3: Check token generation status (if needed)
const tokenStatus = await client.auth.getTokenGenerationStatus(
  tokenResponse.elementReferenceNumber,
  sessionToken
);

if (tokenStatus.token) {
  console.log('Generated Token:', tokenStatus.token);
  // Store this token securely for future use
}
```

### Phase 3: Use Authorization Token (Regular Operations)

```typescript
// Step 4: Use the stored authorization token for future sessions
const newSessionToken = await client.auth.authenticate({
  token: 'your-stored-authorization-token'
}, {
  type: 'onip',
  value: '1234567890'
});

// Now you can perform operations
const invoiceResponse = await client.invoice.submitInvoice(
  invoiceXml,
  newSessionToken
);
```

### Phase 4: Token Management

```typescript
// Step 5: Query all active tokens
const activeTokens = await client.auth.queryTokens(
  {
    type: 'onip',
    value: '1234567890'
  },
  sessionToken,
  true // Include details
);

console.log('Active Tokens:', activeTokens.tokenList);

// Step 6: Revoke a token when no longer needed
await client.auth.revokeToken(
  'token-number-to-revoke',
  sessionToken
);
```

## 🔄 Authentication Methods Comparison

| Method | Use Case | Frequency | Security Level |
|--------|----------|----------|----------------|
| **Certificate** | Initial setup, token generation | One-time | Highest |
| **Authorization Token** | Regular operations | Per session | High |
| **Session Token** | API operations | Per request | Medium |

## 📊 Complete Workflow Example

```typescript
import { KSeFClient } from '@ksef/client';

async function completeTokenLifecycle() {
  const client = new KSeFClient({ environment: 'test' });
  
  // 1. Initial authentication with certificate
  console.log('🔐 Step 1: Certificate Authentication');
  const sessionToken = await client.auth.authenticate({
    certificate: process.env.KSEF_CERT,
    password: process.env.KSEF_CERT_PASSWORD
  }, {
    type: 'onip',
    value: process.env.KSEF_NIP
  });
  console.log('✅ Session established');

  // 2. Generate authorization token
  console.log('🔑 Step 2: Generate Authorization Token');
  const tokenResponse = await client.auth.generateToken(
    {
      certificate: process.env.KSEF_CERT,
      password: process.env.KSEF_CERT_PASSWORD
    },
    {
      type: 'onip',
      value: process.env.KSEF_NIP
    },
    'Production Application Token'
  );
  
  // 3. Poll for token completion
  let token = null;
  let attempts = 0;
  while (!token && attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    const status = await client.auth.getTokenGenerationStatus(
      tokenResponse.elementReferenceNumber,
      sessionToken
    );
    
    if (status.token) {
      token = status.token;
      break;
    }
    attempts++;
  }
  
  if (token) {
    console.log('✅ Authorization token generated:', token);
    
    // Store token securely (database, vault, etc.)
    await storeTokenSecurely(token);
  }

  // 4. Use authorization token for regular operations
  console.log('🚀 Step 3: Using Authorization Token');
  const newSessionToken = await client.auth.authenticate({
    token: token
  }, {
    type: 'onip',
    value: process.env.KSEF_NIP
  });

  // 5. Perform business operations
  const invoiceXml = generateInvoiceXml();
  const invoiceResponse = await client.invoice.submitInvoice(
    invoiceXml,
    newSessionToken
  );
  console.log('✅ Invoice submitted:', invoiceResponse.elementReferenceNumber);

  // 6. Query active tokens
  console.log('📋 Step 4: Token Management');
  const activeTokens = await client.auth.queryTokens(
    {
      type: 'onip',
      value: process.env.KSEF_NIP
    },
    newSessionToken,
    true
  );
  
  console.log('Active tokens:', activeTokens.tokenList?.length || 0);

  // 7. Clean up unused tokens
  for (const activeToken of activeTokens.tokenList || []) {
    if (activeToken.description === 'Old Token') {
      await client.auth.revokeToken(
        activeToken.tokenNumber,
        newSessionToken
      );
      console.log('🗑️ Revoked old token:', activeToken.tokenNumber);
    }
  }
}

// Helper function to store token securely
async function storeTokenSecurely(token: string) {
  // Implementation depends on your security requirements
  // Examples: database encryption, HashiCorp Vault, AWS Secrets Manager
  console.log('💾 Token stored securely');
}

// Helper function to generate invoice XML
function generateInvoiceXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2025/02/14/02141/">
  <!-- Your invoice content -->
</Faktura>`;
}
```

## 🛡️ Security Best Practices

### Token Storage
- **Never store tokens in plain text**
- Use encrypted storage (database encryption, vaults)
- Implement token rotation policies
- Monitor token usage and access patterns

### Certificate Management
- Store certificates securely
- Use hardware security modules (HSM) when possible
- Implement certificate expiration monitoring
- Rotate certificates before expiration

### Session Management
- Use short-lived session tokens
- Implement proper session cleanup
- Monitor for suspicious activity
- Use HTTPS for all communications

## 🔧 Error Handling

```typescript
try {
  const sessionToken = await client.auth.authenticate(credentials, context);
} catch (error) {
  if (error.message.includes('Certificate validation failed')) {
    console.error('❌ Certificate issue:', error.message);
    // Handle certificate problems
  } else if (error.message.includes('Unauthorized')) {
    console.error('❌ Authentication failed:', error.message);
    // Handle authentication issues
  } else {
    console.error('❌ Unexpected error:', error.message);
    // Handle other errors
  }
}
```

## 📈 Performance Considerations

### Token Caching
- Cache session tokens for the duration of their validity
- Implement token refresh mechanisms
- Use connection pooling for HTTP requests

### Batch Operations
- Use batch processing for multiple invoices
- Implement retry mechanisms with exponential backoff
- Monitor API rate limits

## 🚨 Troubleshooting

### Common Issues

1. **Certificate Validation Failed**
   - Check certificate format and validity
   - Verify certificate password
   - Ensure certificate is not expired

2. **Token Generation Timeout**
   - Implement proper polling with delays
   - Check network connectivity
   - Verify KSeF service status

3. **Session Token Expired**
   - Implement automatic token refresh
   - Handle 401 errors gracefully
   - Re-authenticate when needed

### Debug Mode

```typescript
const client = new KSeFClient({
  environment: 'test',
  debug: true // Enables detailed logging
});
```

## 📚 API Reference

### Authentication Service Methods

- `authenticate(credentials, context)` - Authenticate with certificate or token
- `generateToken(credentials, context, description?)` - Generate new authorization token
- `revokeToken(tokenNumber, sessionToken)` - Revoke existing token
- `queryTokens(context, sessionToken, includeDetails?)` - List active tokens
- `getTokenGenerationStatus(referenceNumber, sessionToken)` - Check token generation status

### Token Types

- `CertificateCredentials` - Certificate-based authentication
- `TokenCredentials` - Token-based authentication
- `SessionToken` - Active session token
- `GenerateTokenResponse` - Token generation response
- `QueryTokensResponse` - Token listing response

## 🔗 Related Documentation

- [Basic Usage Guide](../examples/basic-usage.ts)
- [Integration Testing](INTEGRATION_TESTING.md)
- [External Signing Guide](../EXTERNAL_SIGNING_GUIDE.md)
- [API Reference](../README.md)

---

This guide provides a complete understanding of the KSeF token lifecycle, enabling you to implement secure and efficient authentication patterns in your applications.

