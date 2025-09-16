/**
 * Basic usage example for KSeF TypeScript client
 */

import { createKsefClient, createProdClient, createTestClient, createTestExternalSigningClient, createProdExternalSigningClient } from '../src/client.js';
import type { CertificateCredentials, KsefClientConfig } from '../src/types/index.js';
import { readFileSync } from 'fs';

// Example 1: Certificate-based authentication
async function exampleCertificateAuth() {
  const credentials: CertificateCredentials = {
    certificate: readFileSync('./certificates/company-cert.p12'),
    password: 'certificate-password'
  };

  const config: KsefClientConfig = {
    environment: 'test', // or 'prod'
    credentials,
    contextIdentifier: {
      type: 'onip',
      value: '1234567890'
    },
    debug: true
  };

  const client = createKsefClient(config);

  try {
    // Login
    const session = await client.login();
    console.log('Authenticated successfully:', session);

    // Submit an invoice
    const invoiceXml = readFileSync('./invoices/sample-invoice.xml', 'utf-8');
    const result = await client.submitInvoice(invoiceXml);
    console.log('Invoice submitted:', result);

    // Query invoices
    const queryResult = await client.queryInvoices({
      subjectType: 'SUBJECT1',
      dateRange: {
        dateType: 'INVOICE_DATE',
        from: '2024-01-01',
        to: '2024-12-31'
      },
      pageSize: 10
    });
    console.log('Query result:', queryResult);

    // Get specific invoice
    if (result.ksefReferenceNumber) {
      const invoice = await client.getInvoice(result.ksefReferenceNumber);
      console.log('Retrieved invoice:', invoice);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example 2: Token-based authentication
async function exampleTokenAuth() {
  const credentials = {
    authToken: 'your-long-lived-token-here'
  };

  const client = createTestClient(
    credentials,
    { type: 'nip', value: '1234567890' },
    true
  );

  try {
    const session = await client.login();
    console.log('Token-based auth successful:', session);
  } catch (error) {
    console.error('Token auth failed:', error);
  }
}

// Example 3: AWS Lambda handler
export const lambdaHandler = async (event: any) => {
  const credentials: CertificateCredentials = {
    certificate: process.env.KSEF_CERTIFICATE_BASE64!, // From AWS Secrets Manager
    password: process.env.KSEF_CERTIFICATE_PASSWORD!
  };

  const client = createProdClient(
    credentials,
    { type: 'nip', value: event.companyNip! }
  );

  try {
    // Process invoice from event
    const invoiceXml = event.invoiceXml;
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
    console.error('Lambda processing failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

// Example 4: Batch processing
async function exampleBatchProcessing() {
  const client = createTestClient(
    { certificate: './cert.p12', password: 'pass' },
    { type: 'nip', value: '1234567890' }
  );

  try {
    // Read multiple invoices
    const invoices = [
      readFileSync('./invoices/invoice1.xml', 'utf-8'),
      readFileSync('./invoices/invoice2.xml', 'utf-8'),
      readFileSync('./invoices/invoice3.xml', 'utf-8')
    ];

    // Submit in batch (this would use the batch service when completed)
    console.log(`Processing ${invoices.length} invoices...`);
    
    // For now, submit individually
    for (const [index, invoiceXml] of invoices.entries()) {
      try {
        const result = await client.submitInvoice(invoiceXml);
        console.log(`Invoice ${index + 1} submitted:`, result.ksefReferenceNumber);
      } catch (error) {
        console.error(`Invoice ${index + 1} failed:`, error);
      }
    }
  } catch (error) {
    console.error('Batch processing failed:', error);
  }
}

// Example 5: External signature delegation (recommended for providers)
async function exampleExternalSignatureDelegation() {
  // Step 1: Create client for external signing (no credentials needed)
  const client = createTestExternalSigningClient({
    type: 'nip',
    value: '1234567890'
  });

  try {
    // Step 2: Generate authentication XML for user to sign
    const authData = await client.generateAuthenticationXML();
    console.log('Generated XML for signing:', authData.xml);
    console.log('Challenge:', authData.challenge);
    console.log('Timestamp:', authData.timestamp);

    // Step 3: User signs the XML with their certificate/EPUAP
    // This would typically happen in the user's environment
    const signedXML = await signXMLExternally(authData.xml);
    console.log('User signed XML received');

    // Step 4: Authenticate with the signed XML
    const session = await client.authenticateWithSignedXML(signedXML);
    console.log('External signature authentication successful:', session);

    // Step 5: Now you can perform KSeF operations
    const invoiceXml = readFileSync('./invoices/sample-invoice.xml', 'utf-8');
    const result = await client.submitInvoice(invoiceXml);
    console.log('Invoice submitted:', result);

  } catch (error) {
    console.error('External signature flow failed:', error);
  }
}

// Mock function for external XML signing
async function signXMLExternally(xmlToSign: string): Promise<string> {
  // This would be implemented by the user's signing system
  // Could be:
  // - Qualified certificate signing
  // - EPUAP signing
  // - Other trusted signing methods
  
  console.log('User would sign this XML with their certificate:');
  console.log(xmlToSign);
  
  // For demo purposes, return a mock signed XML
  // In reality, this would be the actual signed XML from user's certificate
  return `<?xml version="1.0" encoding="UTF-8"?>
<InitSessionSignedRequest xmlns="http://ksef.mf.gov.pl/schema/gtw/svc/online/auth/request/202310/v1">
  <Context>{"contextIdentifier":{"type":"nip","value":"1234567890"},"challenge":"mock-challenge","timestamp":"2024-01-15T10:30:00Z"}</Context>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <Reference URI="">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <DigestValue>mock-digest-value</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>mock-signature-value</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>mock-certificate-data</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>
</InitSessionSignedRequest>`;
}

// Example 6: Provider integration with external signing
export const providerIntegrationHandler = async (event: any) => {
  const client = createProdExternalSigningClient({
    type: 'nip',
    value: event.userNip
  });

  try {
    // Step 1: Generate authentication XML
    const authData = await client.generateAuthenticationXML();
    
    // Step 2: Return XML to user for signing
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        xmlToSign: authData.xml,
        challenge: authData.challenge,
        timestamp: authData.timestamp,
        message: 'Please sign this XML with your certificate and return the signed version'
      })
    };
  } catch (error) {
    console.error('Failed to generate authentication XML:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

// Example 7: Complete external signing workflow
export const completeExternalSigningWorkflow = async (event: any) => {
  const client = createProdExternalSigningClient({
    type: 'nip',
    value: event.userNip
  });

  try {
    // Step 1: Generate authentication XML
    const authData = await client.generateAuthenticationXML();
    
    // Step 2: User signs the XML (this would happen externally)
    const signedXML = event.signedXML; // Received from user
    
    // Step 3: Authenticate with signed XML
    const session = await client.authenticateWithSignedXML(signedXML);
    
    // Step 4: Perform KSeF operations
    const result = await client.submitInvoice(event.invoiceXml);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ksefReferenceNumber: result.ksefReferenceNumber,
        acquisitionTimestamp: result.acquisitionTimestamp
      })
    };
  } catch (error) {
    console.error('External signing workflow failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

// Run examples
if (require.main === module) {
  console.log('Running KSeF client examples...');
  
  // Uncomment the example you want to run:
  // exampleCertificateAuth();
  // exampleTokenAuth();
  // exampleBatchProcessing();
  // exampleExternalSignatureDelegation();
} 