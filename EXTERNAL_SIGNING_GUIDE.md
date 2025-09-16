# KSeF External Signature Delegation Guide

This guide explains how to implement secure authentication with KSeF using external signature delegation, where your system generates the authentication XML and users sign it with their own certificates or EPUAP.

## Overview

The external signature delegation approach provides several advantages:

- **Security**: Your system never handles users' private keys
- **Compliance**: Users maintain full control over their certificates
- **Flexibility**: Supports qualified certificates, EPUAP, and other signing methods
- **User Experience**: Users can use their existing signing tools and workflows

## Authentication Flow

### Step 1: Generate Authentication XML

Your system generates the XML that needs to be signed:

```typescript
import { createProdExternalSigningClient } from '@ksef/client';

const client = createProdExternalSigningClient({
  type: 'nip',
  value: '1234567890' // User's NIP
});

// Generate XML for user to sign
const authData = await client.generateAuthenticationXML();

console.log('XML to sign:', authData.xml);
console.log('Challenge:', authData.challenge);
console.log('Timestamp:', authData.timestamp);
```

### Step 2: User Signs the XML

The user signs the XML with their certificate or EPUAP. This can happen in several ways:

#### Option A: Qualified Certificate Signing
```typescript
// User's environment - they sign with their certificate
const signedXML = await signWithQualifiedCertificate(authData.xml);
```

#### Option B: EPUAP Signing
```typescript
// User's environment - they sign with EPUAP
const signedXML = await signWithEPUAP(authData.xml);
```

#### Option C: Other Trusted Signing Methods
```typescript
// User's environment - they sign with their preferred method
const signedXML = await signWithTrustedMethod(authData.xml);
```

### Step 3: Authenticate with Signed XML

Your system receives the signed XML and authenticates with KSeF:

```typescript
// Authenticate with the signed XML
const session = await client.authenticateWithSignedXML(signedXML);

console.log('Authentication successful:', session);
```

### Step 4: Perform KSeF Operations

Once authenticated, you can perform all KSeF operations:

```typescript
// Submit invoice
const result = await client.submitInvoice(invoiceXml);

// Query invoices
const invoices = await client.queryInvoices({
  subjectType: 'SUBJECT1',
  dateRange: {
    dateType: 'INVOICE_DATE',
    from: '2024-01-01',
    to: '2024-12-31'
  }
});
```

## Implementation Examples

### Web Application Integration

```typescript
// API endpoint to generate authentication XML
app.post('/api/ksef/generate-auth', async (req, res) => {
  const { userNip } = req.body;
  
  const client = createProdExternalSigningClient({
    type: 'nip',
    value: userNip
  });

  try {
    const authData = await client.generateAuthenticationXML();
    
    res.json({
      success: true,
      xmlToSign: authData.xml,
      challenge: authData.challenge,
      timestamp: authData.timestamp
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to authenticate with signed XML
app.post('/api/ksef/authenticate', async (req, res) => {
  const { userNip, signedXML } = req.body;
  
  const client = createProdExternalSigningClient({
    type: 'nip',
    value: userNip
  });

  try {
    const session = await client.authenticateWithSignedXML(signedXML);
    
    // Store session for future operations
    await storeUserSession(userNip, session);
    
    res.json({
      success: true,
      session: session
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### AWS Lambda Integration

```typescript
// Lambda function for generating authentication XML
export const generateAuthXML = async (event: any) => {
  const { userNip } = event;
  
  const client = createProdExternalSigningClient({
    type: 'nip',
    value: userNip
  });

  try {
    const authData = await client.generateAuthenticationXML();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        xmlToSign: authData.xml,
        challenge: authData.challenge,
        timestamp: authData.timestamp
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

// Lambda function for processing signed XML
export const processSignedXML = async (event: any) => {
  const { userNip, signedXML, invoiceXml } = event;
  
  const client = createProdExternalSigningClient({
    type: 'nip',
    value: userNip
  });

  try {
    // Authenticate with signed XML
    const session = await client.authenticateWithSignedXML(signedXML);
    
    // Submit invoice
    const result = await client.submitInvoice(invoiceXml);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ksefReferenceNumber: result.ksefReferenceNumber,
        acquisitionTimestamp: result.acquisitionTimestamp
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
```

## User Interface Integration

### Frontend JavaScript Example

```javascript
// Generate authentication XML
async function generateAuthXML(userNip) {
  const response = await fetch('/api/ksef/generate-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userNip })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Display XML to user for signing
    document.getElementById('xml-to-sign').textContent = data.xmlToSign;
    document.getElementById('signing-section').style.display = 'block';
  } else {
    alert('Failed to generate authentication XML: ' + data.error);
  }
}

// Handle user signing
async function handleUserSigning() {
  const xmlToSign = document.getElementById('xml-to-sign').textContent;
  
  // User signs the XML (this would integrate with their signing tool)
  const signedXML = await userSignXML(xmlToSign);
  
  // Submit signed XML to your system
  const response = await fetch('/api/ksef/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userNip: document.getElementById('user-nip').value,
      signedXML: signedXML
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    alert('Authentication successful!');
    // Proceed with KSeF operations
  } else {
    alert('Authentication failed: ' + data.error);
  }
}
```

## Security Considerations

### XML Validation

Always validate the signed XML before submitting to KSeF:

```typescript
// Validate signed XML structure
function validateSignedXML(xml: string): boolean {
  const requiredElements = [
    '<InitSessionSignedRequest',
    '<Context>',
    '<Signature',
    '<SignatureValue>',
    '<X509Certificate>'
  ];
  
  return requiredElements.every(element => xml.includes(element));
}
```

### Session Management

Store sessions securely and implement proper session management:

```typescript
// Store session securely
async function storeUserSession(userNip: string, session: SessionToken) {
  const encryptedSession = await encryptSession(session);
  await database.storeSession(userNip, encryptedSession);
}

// Retrieve session for operations
async function getStoredSession(userNip: string): Promise<SessionToken | null> {
  const encryptedSession = await database.getSession(userNip);
  if (encryptedSession) {
    return await decryptSession(encryptedSession);
  }
  return null;
}
```

### Error Handling

Implement comprehensive error handling:

```typescript
try {
  const session = await client.authenticateWithSignedXML(signedXML);
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Handle authentication-specific errors
    console.error('Authentication failed:', error.message);
  } else if (error instanceof ProcessError) {
    // Handle KSeF process errors
    console.error('KSeF process error:', error.message);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error.message);
  }
}
```

## Best Practices

1. **Always validate signed XML** before submitting to KSeF
2. **Implement proper session management** with encryption
3. **Handle errors gracefully** with user-friendly messages
4. **Log authentication attempts** for audit purposes
5. **Implement rate limiting** to prevent abuse
6. **Use HTTPS** for all communications
7. **Store sensitive data encrypted** at rest and in transit

## Troubleshooting

### Common Issues

1. **Invalid XML Structure**: Ensure the signed XML contains all required elements
2. **Certificate Issues**: Verify the user's certificate is valid and authorized
3. **Timestamp Issues**: Check that the timestamp is within acceptable range
4. **Network Issues**: Ensure proper connectivity to KSeF endpoints

### Debug Information

Enable debug logging to troubleshoot issues:

```typescript
const client = createProdExternalSigningClient({
  type: 'nip',
  value: userNip
});
```

This approach provides a secure, flexible, and user-friendly way to integrate with KSeF while maintaining proper security practices and user control over their authentication credentials. 