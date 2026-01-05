# KSeF Integration Testing Guide

This guide explains how to set up and run comprehensive integration tests against the official Polish KSeF (Krajowy System e-Faktur) test environment.

## Overview

The integration tests in `tests/integration.test.ts` provide complete end-to-end testing of all KSeF functionality:

- **Authentication**: Certificate-based and token-based authentication flows
- **Invoice Operations**: Single and batch invoice submission, retrieval, and UPO handling
- **Query Operations**: Synchronous and asynchronous invoice queries
- **Permissions Management**: Granting, revoking, and querying user permissions
- **Error Handling**: Network timeouts, invalid data, authentication failures
- **Performance Testing**: Load testing and operation timing
- **Complete E2E Workflows**: Full invoice lifecycle from submission to UPO retrieval

## Prerequisites

### 1. Test Environment Access

The tests run against the official KSeF test environment:
```
https://api-test.ksef.mf.gov.pl/v2
```

### 2. Test Certificates and Credentials

You need valid test certificates and credentials provided by the Polish Ministry of Finance. These are typically:

- **Test Certificate**: A `.p12` or `.pfx` file containing a valid test certificate
- **Certificate Password**: Password for the test certificate (if required)
- **Test NIP**: A valid test company NIP (10-digit tax identifier)
- **Test PESEL** (optional): A valid test personal PESEL for permission testing

## Environment Setup

### 1. Environment Variables

Set the following environment variables before running tests:

```bash
# Required
export KSEF_TEST_CERT_PATH="/path/to/your/test-certificate.p12"
export KSEF_TEST_NIP="1234567890"

# Optional
export KSEF_TEST_CERT_PASSWORD="your-certificate-password"
export KSEF_TEST_PESEL="12345678901"
```

### 2. Alternative: .env File

Create a `.env.integration` file in the project root:

```env
KSEF_TEST_CERT_PATH=/path/to/your/test-certificate.p12
KSEF_TEST_CERT_PASSWORD=your-certificate-password
KSEF_TEST_NIP=1234567890
KSEF_TEST_PESEL=12345678901
```

Then load it before running tests:
```bash
export $(cat .env.integration | xargs)
```

## Obtaining Test Credentials

### Official Test Certificates

Contact the Polish Ministry of Finance or check their official documentation for obtaining test certificates:

1. Visit the official KSeF documentation portal
2. Follow the integration testing guidelines
3. Request test certificates for your organization
4. Download the test certificate files (.p12/.pfx format)

### Test Environment NIPs

The Ministry provides specific test NIPs for integration testing. Common patterns:

- Use NIPs specifically designated for testing
- Ensure the NIP matches your test certificate
- Some test NIPs may be pre-configured in the test environment

## Running the Tests

### Run All Integration Tests

```bash
npm run test:integration
```

### Run Specific Test Suites

```bash
# Authentication tests only
npm test -- tests/integration.test.ts -t "Authentication Tests"

# Invoice operations only
npm test -- tests/integration.test.ts -t "Single Invoice Operations"

# Batch operations only
npm test -- tests/integration.test.ts -t "Batch Session Operations"

# End-to-end workflow
npm test -- tests/integration.test.ts -t "Complete E2E Workflow"
```

### Debug Mode

Run tests with verbose output:

```bash
DEBUG=ksef:* npm run test:integration
```

### Skip Tests Without Configuration

If environment variables are not set, tests will automatically skip with a warning:

```
⚠ Skipping integration tests - missing required environment variables
Required: KSEF_TEST_CERT_PATH, KSEF_TEST_NIP
Optional: KSEF_TEST_CERT_PASSWORD, KSEF_TEST_PESEL
```

## Test Structure

### 1. Authentication Tests
- Certificate-based authentication
- Token generation and usage
- Authentication with invalid credentials
- Session management

### 2. Single Invoice Operations
- Invoice submission (interactive mode)
- Invoice retrieval by KSeF reference
- UPO (proof of receipt) retrieval
- Validation error handling

### 3. Invoice Query Operations
- Query invoices by date range
- Asynchronous query operations
- Pagination and filtering

### 4. Batch Session Operations
- Complete batch workflow (3 invoices)
- Mixed success/failure handling
- Batch status tracking

### 5. Permissions Management
- Query current permissions
- Grant/revoke permissions (PESEL testing)
- Role type handling

### 6. Error Handling and Edge Cases
- Session timeout scenarios
- Non-existent invoice retrieval
- Network timeout handling

### 7. Performance and Load Tests
- Rapid sequential operations
- Operation timing measurements
- Concurrent request handling

### 8. Complete E2E Workflow
- Full invoice lifecycle test
- Authentication → Submit → Retrieve → UPO → Query → Logout

## Test Data and Samples

### Sample Invoice Template

The tests use a valid FA(2) invoice template that includes:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (2)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>2</WariantFormularza>
    <!-- Dynamic test data populated at runtime -->
  </Naglowek>
  <!-- Complete invoice structure... -->
</Faktura>
```

Dynamic fields are populated during test execution:
- `{{DATE}}`: Current date
- `{{SELLER_NIP}}`: Test NIP from environment
- `{{INVOICE_NUMBER}}`: Unique invoice number per test

## Expected Results

### Successful Test Run

```
✅ KSeF Integration Tests
  ✅ Authentication Tests (4 tests)
  ✅ Single Invoice Operations (4 tests)
  ✅ Invoice Query Operations (2 tests)
  ✅ Batch Session Operations (2 tests)
  ✅ Permissions Management (2 tests)
  ✅ Error Handling and Edge Cases (3 tests)
  ✅ Performance and Load Tests (2 tests)
  ✅ Complete E2E Workflow (1 test)

Total: 20 tests passed
```

### Test Artifacts

During test execution, the following artifacts are created and verified:

1. **Session Tokens**: Valid authentication tokens
2. **KSeF References**: Unique invoice identifiers from successful submissions
3. **UPO Documents**: Official receipts in binary format
4. **Auth Tokens**: Long-term authentication tokens

## Troubleshooting

### Common Issues

#### "Certificate not found" Error
```bash
Error: ENOENT: no such file or directory, open '/path/to/cert.p12'
```
**Solution**: Verify the certificate path in `KSEF_TEST_CERT_PATH`

#### "Authentication failed" Error
```bash
AuthenticationError: Unauthorized access
```
**Solutions**:
- Verify certificate password
- Check if certificate is valid and not expired
- Ensure NIP matches the certificate
- Confirm certificate is authorized for the test NIP

#### "Permission denied" Error
```bash
ProcessError: Permission not granted
```
**Solutions**:
- Use a certificate that has admin rights for the test NIP
- Grant permissions first using an authorized certificate
- Check if PESEL is already authorized

#### Network Timeout Issues
```bash
Error: Request timeout after 60000ms
```
**Solutions**:
- Check internet connectivity
- Verify KSeF test environment is accessible
- Increase timeout values for slow networks

### Debug Information

Enable debug logging to see detailed request/response information:

```bash
export DEBUG=ksef:*
npm run test:integration
```

This will show:
- HTTP requests and responses
- Authentication flows
- Session token management
- Error details

## Test Environment Limitations

### Rate Limiting
- The test environment may have rate limits
- Large batch tests might be throttled
- Add delays between test runs if needed

### Data Persistence
- Test data may be cleaned up periodically
- Don't rely on test invoices persisting long-term
- Each test run should be self-contained

### Resource Constraints
- Test environment may have limited resources
- Some operations might be slower than production
- Timeouts are set generously to accommodate this

## Continuous Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM
  workflow_dispatch:

jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        env:
          KSEF_TEST_CERT_PATH: ${{ secrets.KSEF_TEST_CERT_PATH }}
          KSEF_TEST_CERT_PASSWORD: ${{ secrets.KSEF_TEST_CERT_PASSWORD }}
          KSEF_TEST_NIP: ${{ secrets.KSEF_TEST_NIP }}
          KSEF_TEST_PESEL: ${{ secrets.KSEF_TEST_PESEL }}
        run: npm run test:integration
```

### Security Considerations

- Store certificates as GitHub Secrets
- Use base64 encoding for certificate files
- Never commit real certificates to version control
- Rotate test certificates regularly

## Contributing

When adding new integration tests:

1. Follow the existing test structure
2. Use the `skipIfMissingConfig()` pattern for optional tests
3. Include proper cleanup in `afterAll`
4. Add comprehensive assertions
5. Include performance timing where relevant
6. Document expected behavior and edge cases

## Support

For issues with integration testing:

1. Check this documentation first
2. Verify your test environment setup
3. Review the KSeF official documentation
4. Contact the Ministry of Finance for test credential issues
5. File issues in this repository for code-related problems 
