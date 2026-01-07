# KSeF External Signature Delegation Guide (API 2.0)

This guide explains how to implement secure authentication with KSeF API v2 using external signature delegation, where your system prepares the AuthTokenRequest XML and users sign it with their own certificates or EPUAP.

## Overview

The external signature delegation approach provides several advantages:

- **Security**: Your system never handles users' private keys
- **Compliance**: Users maintain full control over their certificates
- **Flexibility**: Supports qualified certificates, EPUAP, and other signing methods
- **User Experience**: Users can use their existing signing tools and workflows

KSeF API v2 uses the XAdES authentication flow:

1. Request a challenge (`/auth/challenge`)
2. Build and sign `AuthTokenRequest` XML (XAdES)
3. Send signed XML to `/auth/xades-signature`
4. Poll status and redeem tokens (`/auth/{referenceNumber}`, `/auth/token/redeem`)

## Authentication Flow

### Step 1: Request a challenge and build AuthTokenRequest XML

Your system requests the challenge and constructs the unsigned XML for the user to sign:

```typescript
import { KsefApiV2Client, ContextIdentifierType } from '@ksef/client';

const client = new KsefApiV2Client({ environment: 'prod' });
const context = { type: ContextIdentifierType.NIP, value: '1234567890' };

const challenge = await client.authentication.requestChallenge();
const xmlToSign = buildUnsignedAuthTokenRequest({
  challenge: challenge.challenge,
  contextIdentifier: context,
  subjectIdentifierType: 'certificateSubject'
});

console.log('XML to sign:', xmlToSign);
```

Use the same structure as `src/api2/auth/xades-request.ts`:

```typescript
import { ContextIdentifierType } from '@ksef/client';

type SubjectIdentifierTypeV2 = 'certificateSubject' | 'certificateFingerprint';

interface BuildAuthTokenRequestParams {
  challenge: string;
  contextIdentifier: { type: ContextIdentifierType; value: string };
  subjectIdentifierType: SubjectIdentifierTypeV2;
}

const AUTH_NS = 'http://ksef.mf.gov.pl/auth/token/2.0';
const DS_NS = 'http://www.w3.org/2000/09/xmldsig#';

function buildUnsignedAuthTokenRequest(params: BuildAuthTokenRequestParams): string {
  const contextXml = buildContextIdentifier(params.contextIdentifier);
  return `<?xml version="1.0" encoding="utf-8"?>
<AuthTokenRequest xmlns="${AUTH_NS}" xmlns:ds="${DS_NS}">
  <Challenge>${params.challenge}</Challenge>
  <ContextIdentifier>
    ${contextXml}
  </ContextIdentifier>
  <SubjectIdentifierType>${params.subjectIdentifierType}</SubjectIdentifierType>
</AuthTokenRequest>`;
}

function buildContextIdentifier(context: { type: ContextIdentifierType; value: string }): string {
  switch (context.type) {
    case ContextIdentifierType.NIP:
      return `<Nip>${context.value}</Nip>`;
    case ContextIdentifierType.INTERNAL_ID:
      return `<InternalId>${context.value}</InternalId>`;
    case ContextIdentifierType.NIP_VAT_UE:
      return `<NipVatUe>${context.value}</NipVatUe>`;
    case ContextIdentifierType.PEPPOL_ID:
      return `<PeppolId>${context.value}</PeppolId>`;
    default:
      throw new Error(`Unsupported context identifier type: ${context.type}`);
  }
}
```

### Step 2: User signs the XML (XAdES)

The user signs the XML with their certificate or EPUAP. The signed XML must include an XAdES signature inside the `AuthTokenRequest` as described in `uwierzytelnianie.md`.

#### Option A: Qualified certificate signing
```typescript
// User's environment - they sign with their certificate
const signedXml = await signWithQualifiedCertificate(xmlToSign);
```

#### Option B: EPUAP signing
```typescript
// User's environment - they sign with EPUAP
const signedXml = await signWithEPUAP(xmlToSign);
```

#### Option C: Other trusted signing methods
```typescript
// User's environment - they sign with their preferred method
const signedXml = await signWithTrustedMethod(xmlToSign);
```

### Step 3: Initiate XAdES authentication and redeem tokens

Send the signed XML to KSeF, poll the authentication status, then redeem access tokens:

```typescript
const init = await client.authentication.initiateXadesAuthentication(signedXml, undefined, {
  verifyCertificateChain: true
});

let status = await client.authentication.getAuthenticationStatus(
  init.referenceNumber,
  init.authenticationToken.token
);

while (status.status.code === 100) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  status = await client.authentication.getAuthenticationStatus(
    init.referenceNumber,
    init.authenticationToken.token
  );
}

const tokens = await client.authentication.redeemTokens(init.authenticationToken.token);
console.log('Access token:', tokens.accessToken.token);
```

### Step 4: Perform KSeF operations with the access token

Once authenticated, use the `accessToken` for all KSeF operations:

```typescript
const formCode = { systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' } as const;
const onlineSession = await client.createOnlineSession(tokens.accessToken.token, formCode);

const encrypted = client.encryptInvoice(invoiceXml, onlineSession.encryptionMaterial);
const submission = await client.sendInvoice(tokens.accessToken.token, onlineSession.referenceNumber, encrypted);
await client.closeOnlineSession(tokens.accessToken.token, onlineSession.referenceNumber);

const invoices = await client.queryInvoiceMetadata(tokens.accessToken.token, {
  subjectType: 'Subject1',
  dateRange: {
    dateType: 'Issue',
    from: '2024-01-01',
    to: '2024-12-31'
  }
});
```

## Implementation Examples

### Web Application Integration

```typescript
import { KsefApiV2Client, ContextIdentifierType } from '@ksef/client';

async function waitForAuthCompletion(client: KsefApiV2Client, init: { referenceNumber: string; authenticationToken: { token: string } }) {
  let status = await client.authentication.getAuthenticationStatus(
    init.referenceNumber,
    init.authenticationToken.token
  );

  while (status.status.code === 100) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    status = await client.authentication.getAuthenticationStatus(
      init.referenceNumber,
      init.authenticationToken.token
    );
  }

  if (status.status.code !== 200) {
    throw new Error(`Authentication failed: ${status.status.description} (${status.status.code})`);
  }
}

// API endpoint to generate AuthTokenRequest XML
app.post('/api/ksef/auth/prepare', async (req, res) => {
  const { userNip } = req.body;

  const client = new KsefApiV2Client({ environment: 'prod' });
  const context = { type: ContextIdentifierType.NIP, value: userNip };

  try {
    const challenge = await client.authentication.requestChallenge();
    const xmlToSign = buildUnsignedAuthTokenRequest({
      challenge: challenge.challenge,
      contextIdentifier: context,
      subjectIdentifierType: 'certificateSubject'
    });

    res.json({ success: true, xmlToSign });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint to authenticate with signed XML
app.post('/api/ksef/auth/complete', async (req, res) => {
  const { userNip, signedXml } = req.body;

  const client = new KsefApiV2Client({ environment: 'prod' });

  try {
    const init = await client.authentication.initiateXadesAuthentication(signedXml);
    await waitForAuthCompletion(client, init);
    const tokens = await client.authentication.redeemTokens(init.authenticationToken.token);

    await storeUserTokens(userNip, tokens);

    res.json({ success: true, tokens });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### AWS Lambda Integration

```typescript
import { KsefApiV2Client, ContextIdentifierType } from '@ksef/client';

async function waitForAuthCompletion(client: KsefApiV2Client, init: { referenceNumber: string; authenticationToken: { token: string } }) {
  let status = await client.authentication.getAuthenticationStatus(
    init.referenceNumber,
    init.authenticationToken.token
  );

  while (status.status.code === 100) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    status = await client.authentication.getAuthenticationStatus(
      init.referenceNumber,
      init.authenticationToken.token
    );
  }

  if (status.status.code !== 200) {
    throw new Error(`Authentication failed: ${status.status.description} (${status.status.code})`);
  }
}

// Lambda function for generating AuthTokenRequest XML
export const generateAuthXml = async (event: any) => {
  const { userNip } = event;

  const client = new KsefApiV2Client({ environment: 'prod' });
  const context = { type: ContextIdentifierType.NIP, value: userNip };

  try {
    const challenge = await client.authentication.requestChallenge();
    const xmlToSign = buildUnsignedAuthTokenRequest({
      challenge: challenge.challenge,
      contextIdentifier: context,
      subjectIdentifierType: 'certificateSubject'
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, xmlToSign })
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};

// Lambda function for processing signed XML
export const processSignedXml = async (event: any) => {
  const { userNip, signedXml, invoiceXml } = event;

  const client = new KsefApiV2Client({ environment: 'prod' });

  try {
    const init = await client.authentication.initiateXadesAuthentication(signedXml);
    await waitForAuthCompletion(client, init);
    const tokens = await client.authentication.redeemTokens(init.authenticationToken.token);

    const formCode = { systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' } as const;
    const onlineSession = await client.createOnlineSession(tokens.accessToken.token, formCode);
    const encrypted = client.encryptInvoice(invoiceXml, onlineSession.encryptionMaterial);
    const result = await client.sendInvoice(tokens.accessToken.token, onlineSession.referenceNumber, encrypted);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        referenceNumber: result.referenceNumber
      })
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
```

## User Interface Integration

### Frontend JavaScript Example

```javascript
// Generate AuthTokenRequest XML
async function generateAuthXml(userNip) {
  const response = await fetch('/api/ksef/auth/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userNip })
  });

  const data = await response.json();

  if (data.success) {
    document.getElementById('xml-to-sign').textContent = data.xmlToSign;
    document.getElementById('signing-section').style.display = 'block';
  } else {
    alert('Failed to generate AuthTokenRequest XML: ' + data.error);
  }
}

// Handle user signing
async function handleUserSigning() {
  const xmlToSign = document.getElementById('xml-to-sign').textContent;
  const signedXml = await userSignXml(xmlToSign);

  const response = await fetch('/api/ksef/auth/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userNip: document.getElementById('user-nip').value,
      signedXml: signedXml
    })
  });

  const data = await response.json();

  if (data.success) {
    alert('Authentication successful!');
  } else {
    alert('Authentication failed: ' + data.error);
  }
}
```

## Security Considerations

### XML Validation

Always validate the signed XML before submitting to KSeF:

```typescript
function validateSignedXml(xml: string): boolean {
  const requiredElements = [
    '<AuthTokenRequest',
    '<Challenge>',
    '<ContextIdentifier>',
    '<SubjectIdentifierType>',
    '<ds:Signature',
    '<ds:SignatureValue>',
    '<ds:X509Certificate>'
  ];

  return requiredElements.every((element) => xml.includes(element));
}
```

### Token Management

Store tokens securely and implement proper lifecycle handling:

```typescript
async function storeUserTokens(userNip: string, tokens: { accessToken: any; refreshToken: any }) {
  const encryptedTokens = await encryptTokens(tokens);
  await database.storeTokens(userNip, encryptedTokens);
}

async function getStoredTokens(userNip: string) {
  const encryptedTokens = await database.getTokens(userNip);
  return encryptedTokens ? decryptTokens(encryptedTokens) : null;
}
```

### Error Handling

Implement comprehensive error handling:

```typescript
try {
  const init = await client.authentication.initiateXadesAuthentication(signedXml);
  const tokens = await client.authentication.redeemTokens(init.authenticationToken.token);
} catch (error: any) {
  if (error?.name === 'AuthenticationError') {
    console.error('Authentication failed:', error.message);
  } else if (error?.name === 'ValidationError') {
    console.error('Invalid AuthTokenRequest XML:', error.message);
  } else if (error?.name === 'ProcessError') {
    console.error('KSeF process error:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Best Practices

1. **Persist the challenge** and tie it to the user session to prevent replay.
2. **Validate signed XML** for structure and required namespaces before sending.
3. **Poll and redeem quickly**; `authenticationToken` is short-lived.
4. **Store access and refresh tokens securely** and rotate them on schedule.
5. **Use HTTPS** for all communications.
6. **Log authentication attempts** for audit purposes.
7. **Apply rate limiting** to protect the auth endpoints.

## Troubleshooting

### Common Issues

1. **Invalid XML or signature**: Verify the XAdES signature matches the `AuthTokenRequest` content.
2. **Expired authentication token**: Redeem tokens soon after initialization.
3. **Certificate issues**: Ensure the certificate chain is valid and authorized.
4. **Clock skew**: Keep system time in sync (NTP) to avoid validation errors.

### Debug Information

Wrap the HTTP client for request/response logging if you need deeper diagnostics:

```typescript
import { HttpClient, KsefApiV2Client } from '@ksef/client';

const httpClient = new HttpClient({ timeout: 60000 });
const client = new KsefApiV2Client({ environment: 'test', httpClient });
```

This approach provides a secure, flexible, and user-friendly way to integrate with KSeF while keeping the XAdES signing in the user's environment.
