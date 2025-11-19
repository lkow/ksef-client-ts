/**
 * Multi-Party AWS Lambda Example
 * 
 * Demonstrates processing invoices for multiple NIPs using
 * orchestrator → SQS → worker Lambda pattern
 */

import { KsefClient, DEFAULT_RATE_LIMITS, createHttpClient } from '../src/index.js';
import type { SQSEvent, SQSRecord } from 'aws-lambda';

// ============================================================================
// ORCHESTRATOR LAMBDA
// ============================================================================

interface AuthorizedParty {
  nip: string;
  token: string;
  invoiceCount: number;
}

/**
 * Orchestrator Lambda: Checks authorized parties and queues them for processing
 */
export const orchestratorHandler = async (event: any) => {
  console.log('Starting multi-party orchestration');

  // 1. Get list of parties you're authorized for
  const authorizedParties = await getAuthorizedParties();
  console.log(`Found ${authorizedParties.length} authorized parties`);

  // 2. Cross-check with your backend to see which need processing
  const partiesToProcess = await crossCheckWithBackend(authorizedParties);
  console.log(`${partiesToProcess.length} parties need processing`);

  // 3. Create SQS messages (one per NIP)
  const messages = partiesToProcess.map((party, index) => ({
    Id: `msg-${party.nip}-${Date.now()}-${index}`,
    MessageBody: JSON.stringify({
      nip: party.nip,
      token: party.token,
      timestamp: new Date().toISOString(),
      invoiceCount: party.invoiceCount
    }),
    MessageAttributes: {
      NIP: {
        DataType: 'String',
        StringValue: party.nip
      },
      Priority: {
        DataType: 'Number',
        StringValue: party.invoiceCount > 100 ? '1' : '2' // High priority for large batches
      }
    }
  }));

  // 4. Send to SQS (batch of 10 max per call)
  const queueUrl = process.env.KSEF_QUEUE_URL!;
  
  for (let i = 0; i < messages.length; i += 10) {
    const batch = messages.slice(i, i + 10);
    
    // In real implementation, use AWS SDK:
    // await sqs.sendMessageBatch({ QueueUrl: queueUrl, Entries: batch }).promise();
    
    console.log(`Queued batch ${Math.floor(i / 10) + 1} (${batch.length} messages)`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      totalParties: authorizedParties.length,
      partiesQueued: partiesToProcess.length,
      messagesCreated: messages.length
    })
  };
};

/**
 * Get list of parties you have KSeF authorization for
 */
async function getAuthorizedParties(): Promise<AuthorizedParty[]> {
  // Example: Query your backend or KSeF permissions API
  return [
    { nip: '1234567890', token: 'token-1', invoiceCount: 45 },
    { nip: '0987654321', token: 'token-2', invoiceCount: 120 },
    { nip: '5555555555', token: 'token-3', invoiceCount: 8 }
  ];
}

/**
 * Cross-check with your backend which parties actually need processing
 */
async function crossCheckWithBackend(parties: AuthorizedParty[]): Promise<AuthorizedParty[]> {
  // Example: Filter parties that have pending invoices in your system
  return parties.filter(party => party.invoiceCount > 0);
}

// ============================================================================
// WORKER LAMBDA
// ============================================================================

/**
 * Worker Lambda: Processes invoices for a single NIP from SQS message
 */
export const workerHandler = async (event: SQSEvent) => {
  console.log(`Processing ${event.Records.length} SQS messages`);

  const results = [];

  for (const record of event.Records) {
    try {
      const result = await processPartyInvoices(record);
      results.push(result);
    } catch (error) {
      console.error('Failed to process record:', error);
      // Throw error to return message to queue for retry
      throw error;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      processed: results.length,
      results
    })
  };
};

/**
 * Process invoices for a single party (NIP)
 */
async function processPartyInvoices(record: SQSRecord) {
  const message = JSON.parse(record.body);
  const { nip, token, invoiceCount } = message;

  console.log(`Processing party: NIP ${nip} (${invoiceCount} invoices)`);

  // 1. Create KSeF client for this specific NIP
  const client = new KsefClient({
    environment: process.env.KSEF_ENV as 'test' | 'prod' || 'test',
    credentials: { token },
    contextIdentifier: { type: 'onip', value: nip },
    httpOptions: {
      timeout: 30000,
      rateLimitConfig: {
        ...DEFAULT_RATE_LIMITS,
        enabled: true,
        requestsPerMinute: 50, // Conservative to stay under limits
        maxConcurrentSessions: 3
      }
    },
    debug: true
  });

  // 2. Authenticate
  console.log(`Authenticating for NIP: ${nip}`);
  await client.login();

  // 3. Get invoices for this NIP from your backend
  const invoices = await getInvoicesForNIP(nip);
  console.log(`Retrieved ${invoices.length} invoices for NIP ${nip}`);

  // 4. Process invoices
  const submitted = [];
  const failed = [];

  for (const invoice of invoices) {
    try {
      const result = await client.submitInvoice(invoice.xml);
      
      submitted.push({
        invoiceNumber: invoice.number,
        ksefReferenceNumber: result.ksefReferenceNumber,
        status: result.status
      });

      // Update your backend
      await markInvoiceAsSubmitted(invoice.id, result.ksefReferenceNumber);
      
      console.log(`✓ Submitted: ${invoice.number} → ${result.ksefReferenceNumber}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      failed.push({
        invoiceNumber: invoice.number,
        error: errorMessage
      });

      console.error(`✗ Failed: ${invoice.number} - ${errorMessage}`);
      
      // Update your backend with error
      await markInvoiceAsFailed(invoice.id, errorMessage);
    }
  }

  // 5. Cleanup
  await client.logout();

  const result = {
    nip,
    totalInvoices: invoices.length,
    submitted: submitted.length,
    failed: failed.length,
    details: {
      submitted,
      failed
    }
  };

  console.log(`Completed processing for NIP ${nip}:`, {
    submitted: result.submitted,
    failed: result.failed
  });

  // 6. Publish metrics
  await publishMetrics(nip, result);

  return result;
}

/**
 * Get invoices from your backend for specific NIP
 */
async function getInvoicesForNIP(nip: string) {
  // Example: Query your database
  return [
    { id: 'inv-1', number: 'FV/2025/001', xml: '<Faktura>...</Faktura>' },
    { id: 'inv-2', number: 'FV/2025/002', xml: '<Faktura>...</Faktura>' }
  ];
}

/**
 * Mark invoice as successfully submitted in your backend
 */
async function markInvoiceAsSubmitted(invoiceId: string, ksefRef: string) {
  // Example: Update database
  console.log(`Marking invoice ${invoiceId} as submitted: ${ksefRef}`);
}

/**
 * Mark invoice as failed in your backend
 */
async function markInvoiceAsFailed(invoiceId: string, error: string) {
  // Example: Update database
  console.log(`Marking invoice ${invoiceId} as failed: ${error}`);
}

/**
 * Publish CloudWatch metrics
 */
async function publishMetrics(nip: string, metrics: any) {
  // Example: Use AWS SDK CloudWatch
  console.log(`Publishing metrics for NIP ${nip}:`, metrics);
  
  // In real implementation:
  // await cloudwatch.putMetricData({
  //   Namespace: 'KSeF/MultiParty',
  //   MetricData: [
  //     {
  //       MetricName: 'InvoicesSubmitted',
  //       Value: metrics.submitted,
  //       Unit: 'Count',
  //       Dimensions: [{ Name: 'NIP', Value: nip }]
  //     },
  //     {
  //       MetricName: 'InvoicesFailed',
  //       Value: metrics.failed,
  //       Unit: 'Count',
  //       Dimensions: [{ Name: 'NIP', Value: nip }]
  //     }
  //   ]
  // }).promise();
}

// ============================================================================
// BATCH SUBMISSION LAMBDA (Optional - for offline mode)
// ============================================================================

/**
 * Scheduled Lambda: Submit offline invoices in batch
 * Runs every hour to submit pending offline invoices
 */
export const batchSubmissionHandler = async (event: any) => {
  console.log('Starting batch offline invoice submission');

  // Get all NIPs that have offline invoices pending
  const nipsWithPendingInvoices = await getNIPsWithPendingOfflineInvoices();

  const results = [];

  for (const { nip, token } of nipsWithPendingInvoices) {
    try {
      const client = new KsefClient({
        environment: process.env.KSEF_ENV as 'test' | 'prod' || 'test',
        credentials: { token },
        contextIdentifier: { type: 'onip', value: nip }
      });

      await client.login();

      // Use offline invoice service (would need to be integrated)
      // const result = await offlineService.submitOfflineInvoicesBatch(
      //   client.getCurrentSession(),
      //   { batchSize: 100, continueOnError: true }
      // );

      await client.logout();

      // results.push({ nip, result });
      console.log(`Processed offline invoices for NIP: ${nip}`);
    } catch (error) {
      console.error(`Failed to process offline invoices for NIP ${nip}:`, error);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      nipsProcessed: results.length
    })
  };
};

async function getNIPsWithPendingOfflineInvoices() {
  // Query your storage for NIPs with pending offline invoices
  return [];
}

// ============================================================================
// CLIENT FACTORY PATTERN (Reusable)
// ============================================================================

/**
 * Factory function to create configured client for a NIP
 */
export function createClientForNIP(nip: string, token: string): KsefClient {
  return new KsefClient({
    environment: process.env.KSEF_ENV as 'test' | 'prod' || 'test',
    credentials: { token },
    contextIdentifier: { type: 'onip', value: nip },
    httpOptions: {
      timeout: 30000,
      keepAlive: true,
      rateLimitConfig: {
        enabled: true,
        requestsPerMinute: 50,
        requestsPerHour: 3000,
        maxConcurrentSessions: 3
      }
    },
    debug: process.env.DEBUG === 'true'
  });
}

// ============================================================================
// CLIENT POOL (for managing multiple clients)
// ============================================================================

export class KsefClientPool {
  private clients: Map<string, KsefClient> = new Map();

  /**
   * Get or create client for NIP
   */
  getClient(nip: string, token: string): KsefClient {
    if (!this.clients.has(nip)) {
      const client = createClientForNIP(nip, token);
      this.clients.set(nip, client);
    }
    return this.clients.get(nip)!;
  }

  /**
   * Authenticate all clients
   */
  async authenticateAll(): Promise<void> {
    const authPromises = Array.from(this.clients.values()).map(
      client => client.login()
    );
    await Promise.all(authPromises);
  }

  /**
   * Logout all clients
   */
  async logoutAll(): Promise<void> {
    const logoutPromises = Array.from(this.clients.values()).map(
      client => client.logout()
    );
    await Promise.all(logoutPromises);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clients.clear();
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/**
 * Example: Process multiple NIPs with controlled concurrency
 */
export async function processMultipleNIPs() {
  const parties = [
    { nip: '1234567890', token: 'token-1' },
    { nip: '0987654321', token: 'token-2' },
    { nip: '5555555555', token: 'token-3' }
  ];

  const pool = new KsefClientPool();

  try {
    // Create clients for all parties
    parties.forEach(party => {
      pool.getClient(party.nip, party.token);
    });

    // Authenticate all
    await pool.authenticateAll();

    // Process each party
    for (const party of parties) {
      const client = pool.getClient(party.nip, party.token);
      const invoices = await getInvoicesForNIP(party.nip);

      for (const invoice of invoices) {
        await client.submitInvoice(invoice.xml);
      }
    }

    // Logout all
    await pool.logoutAll();

  } finally {
    pool.cleanup();
  }
}


