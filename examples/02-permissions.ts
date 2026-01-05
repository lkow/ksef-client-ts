/**
 * Example 02: Permissions Management
 * ===================================
 * 
 * This example demonstrates how to query and manage permissions in KSeF.
 * 
 * Prerequisites:
 * 1. Copy env.examples.template to .env.examples
 * 2. Set KSEF_TOKEN with your access token
 * 3. Set KSEF_NIP with your context NIP
 * 
 * Operations:
 * - Query personal permissions for the authenticated user
 * - Query context permissions for a specific NIP
 * - List granted permissions
 */

import {
  getConfig,
  printHeader,
  printStep,
  printSuccess
} from './utils/setup.js';
import {
  KsefApiV2Client,
  ContextIdentifierType
} from '../dist/index.js';

async function main() {
  printHeader(
    '🔐 Example 02: Permissions Management',
    'Query and manage KSeF permissions for users and entities.'
  );

  // Step 1: Load configuration
  printStep(1, 4, 'Loading configuration...');
  const config = getConfig();
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Context NIP: ${config.contextNip}`);

  // Step 2: Create API client
  printStep(2, 4, 'Creating KSeF API v2 client...');
  const client = new KsefApiV2Client({
    environment: config.environment
  });

  // Step 3: Query personal permissions
  printStep(3, 4, 'Querying personal permissions...');
  const personalPermissions = await client.permissions.queryPersonalPermissions(
    config.accessToken,
    {
      // Filter by context NIP (optional)
      contextIdentifier: {
        type: ContextIdentifierType.NIP,
        value: config.contextNip
      }
    },
    { pageSize: 10 }
  );

  console.log(`   Found ${personalPermissions.permissions.length} permission(s):`);
  for (const perm of personalPermissions.permissions) {
    console.log(`\n   Context: ${perm.contextIdentifier.value}`);
    console.log(`   Subject: ${perm.subjectIdentifier.value}`);
    console.log(`   Permissions:`);
    perm.permissions.forEach(p => {
      console.log(`     - ${p.permissionType}`);
    });
  }

  // Step 4: Query person permissions in current context
  printStep(4, 4, 'Querying person permissions in current context...');

  try {
    // queryType options:
    // - 'PermissionsInCurrentContext': List permissions active in current context
    // - 'PermissionsGrantedInCurrentContext': List permissions granted in current context
    const personPermissions = await client.permissions.queryPersonPermissions(
      config.accessToken,
      {
        queryType: 'PermissionsInCurrentContext'
      },
      { pageSize: 10 }
    );

    console.log(`   Found ${personPermissions.permissions.length} person permission(s):`);
    for (const perm of personPermissions.permissions) {
      console.log(`\n   Subject: ${perm.subjectIdentifier?.value ?? 'N/A'} (${perm.subjectIdentifier?.type ?? 'N/A'})`);
      console.log(`   Permissions:`);
      perm.permissions?.forEach((p: any) => {
        console.log(`     - ${p.permissionType ?? p}`);
      });
    }
  } catch (error: any) {
    console.log(`   ⚠️  Cannot query person permissions: ${error.message}`);
    console.log('   (You may need CredentialsRead permission)');
  }

  printSuccess('Permissions query completed!');

  // Bonus: Show available permission types
  console.log('\n📋 Available Permission Types:');
  console.log('   • InvoiceRead       - Read invoices');
  console.log('   • InvoiceWrite      - Send invoices');
  console.log('   • CredentialsRead   - Read credentials');
  console.log('   • CredentialsManage - Manage credentials');
  console.log('   • SubunitManage     - Manage subunits');
  console.log('   • EnforcementOperations - Enforcement authority operations');
}

main().catch(console.error);

