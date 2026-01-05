# KSeF API v2 Examples

This folder contains self-contained, copy-paste-friendly examples for working with the KSeF (Krajowy System e-Faktur) API v2.

## 📋 Quick Start

### 1. Setup Environment (for API examples)

```bash
# Copy the environment template
cp examples/env.examples.template examples/.env.examples

# Edit with your credentials
nano examples/.env.examples
```

Required environment variables:
- `KSEF_TOKEN` - Your KSeF API access token
- `KSEF_NIP` - Your context NIP (10-digit tax ID)
- `KSEF_ENV` - Environment: `test`, `demo`, or `prod` (default: `test`)

### 2. Run Examples

```bash
# Build the library first
pnpm build

# Run any example with tsx (recommended)
npx tsx examples/01-online-invoice.ts

# Or run the QR code example (no credentials needed!)
npx tsx examples/03-qr-codes.ts
```

## 📁 Examples Overview

| File | Prerequisites | Description |
|------|---------------|-------------|
| `01-online-invoice.ts` | Token + NIP | Complete online invoice flow |
| `02-permissions.ts` | Token + NIP | Query and manage permissions |
| `03-qr-codes.ts` | **None** | Generate KOD I & KOD II QR codes |
| `04-offline-invoice.ts` | **None** | Offline invoice workflow |
| `05-token-management.ts` | Token + NIP | Token lifecycle management |
| `06-batch-session.ts` | Token + NIP | Batch upload for bulk invoices |

## 🚀 Examples in Detail

### 01 - Online Invoice Flow
Complete flow for sending a single invoice through an online session:
- Open session with encryption material
- Encrypt invoice XML
- Send to KSeF
- Close session and retrieve status

### 02 - Permissions Management  
Query and understand KSeF permissions:
- Query personal permissions
- Query person permissions (who has access)
- Understand permission types

### 03 - QR Code Generation ⭐ No credentials needed!
Generate KSeF verification QR codes locally:
- **KOD I**: Invoice verification QR (required on every invoice)
- **KOD II**: Certificate verification with digital signature
- Uses auto-generated test certificates for demo

### 04 - Offline Invoice Management ⭐ No credentials needed!
Complete offline invoice workflow:
- Generate offline invoice with QR codes
- Store with deadline tracking
- In-memory storage demonstration
- Deadline calculation for different modes

### 05 - Token Management
Manage KSeF API tokens:
- Query existing tokens
- Generate new tokens with permissions
- Check token status
- Revoke tokens

### 06 - Batch Session
Efficient bulk invoice upload:
- Batch file preparation
- Multi-part upload
- Session status monitoring
- Best practices for high volume

## 🔐 Obtaining Credentials

### Test Environment
1. Go to https://ksef-test.mf.gov.pl
2. Register/authenticate with test credentials
3. Generate an API token with required permissions
4. Use any valid test NIP

### Demo Environment
1. Go to https://ksef-demo.mf.gov.pl
2. Similar to test but with different data sets

### Production Environment
1. Go to https://ksef.mf.gov.pl
2. Use your real business credentials
3. **Caution**: Real invoices will be submitted!

## 📜 Certificate Requirements

For **KOD II** (offline invoice signatures) you need a qualified certificate:

| Type | Usage |
|------|-------|
| Authentication | Login/session authentication |
| Offline | Signing offline invoices (KOD II) |

**Important**: Use the correct certificate type! Offline certificates are specifically for KOD II signatures.

### Supported Algorithms
- RSA-PSS with SHA-256 (2048-bit key minimum)
- ECDSA P-256 (prime256v1 curve)

### Test Certificates
The examples auto-generate test certificates for local demos. In production, use certificates from:
- Qualified Trust Service Providers (QTSP)
- Hardware Security Modules (HSM)

## 🛠️ Utility Functions

The `utils/setup.ts` module provides:

```typescript
import {
  getConfig,              // Load and validate env vars
  loadInvoiceXml,         // Load invoice from file
  generateTestRsaKeyPair, // Generate test RSA key
  generateTestEcKeyPair,  // Generate test EC key
  generateTestOfflineCertificate, // Generate test cert
  printHeader,            // Pretty console output
  printStep,              // Step indicator
  printSuccess,           // Success message
  getTodayIsoDate         // Today's date in ISO format
} from './utils/setup.js';
```

## 📊 Rate Limits Reference

Common API limits:

| Endpoint | Per Second | Per Minute | Per Hour |
|----------|------------|------------|----------|
| Online session | 20 | 120 | 500 |
| Batch session | 10 | 50 | 300 |
| Invoice send | 100 | 600 | 6000 |
| Invoice status | 200 | 1200 | 12000 |
| Session list | 50 | 300 | 3000 |

## 💡 Tips

1. **Start with example 03**: QR codes work offline, no credentials needed
2. **Use test environment first**: Never test with production credentials
3. **Check rate limits**: Use conservative settings for bulk operations
4. **Store references**: Keep session and invoice references for recovery
5. **Handle errors gracefully**: KSeF may return transient errors

## 📚 Additional Resources

- [KSeF Official Documentation](https://github.com/CIRFMF/ksef-docs)
- [API v2 Changes Overview](../docs/CIRFMF_ALIGNMENT.md)
- [Offline Mode Guide](../docs/OFFLINE_MODE_GUIDE.md)
- [Token Lifecycle Guide](../docs/TOKEN_LIFECYCLE_GUIDE.md)

