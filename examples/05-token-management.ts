/**
 * Example 05: Token Management
 * =============================
 * 
 * This example demonstrates KSeF token lifecycle management:
 * - Generate new API tokens with specific permissions
 * - Query existing tokens
 * - Check token status
 * - Revoke tokens
 * 
 * Prerequisites:
 * 1. Copy env.examples.template to .env.examples
 * 2. Set KSEF_TOKEN with your access token
 * 3. Set KSEF_NIP with your context NIP
 * 
 * Important: You need CredentialsManage permission to manage tokens.
 */

import {
  getConfig,
  printHeader,
  printStep,
  printSuccess
} from './utils/setup.js';
import {
  KsefApiV2Client,
  type TokenPermissionType
} from '../dist/index.js';

async function main() {
  printHeader(
    '🔑 Example 05: Token Management',
    'Generate, query, and manage KSeF API tokens.'
  );

  // Step 1: Load configuration
  printStep(1, 5, 'Loading configuration...');
  const config = getConfig();
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Context NIP: ${config.contextNip}`);

  // Step 2: Create API client
  printStep(2, 5, 'Creating KSeF API v2 client...');
  const client = new KsefApiV2Client({
    environment: config.environment
  });

  // Step 3: Query existing tokens
  printStep(3, 5, 'Querying existing tokens...');
  
  try {
    const existingTokens = await client.tokens.queryTokens(
      config.accessToken,
      { pageSize: 10 }
    );

    console.log(`   Found ${existingTokens.tokens.length} token(s):`);
    for (const token of existingTokens.tokens) {
      const perms = token.requestedPermissions.join(', ');
      console.log(`\n   • Ref: ${token.referenceNumber}`);
      console.log(`     Status: ${token.status}`);
      console.log(`     Permissions: ${perms}`);
      console.log(`     Created: ${token.dateCreated}`);
      if (token.lastUseDate) {
        console.log(`     Last used: ${token.lastUseDate}`);
      }
    }
  } catch (error: any) {
    console.log(`   ⚠️  Cannot query tokens: ${error.message}`);
    console.log('   (You may need CredentialsRead permission)');
  }

  // Step 4: Generate a new token (demonstration)
  printStep(4, 5, 'Token generation demonstration...');
  
  // Define permissions for the new token
  const permissions: TokenPermissionType[] = [
    'InvoiceRead',
    'InvoiceWrite'
  ];

  console.log('\n   📋 To generate a new token, use:');
  console.log('');
  console.log('   const newToken = await client.tokens.generateToken(');
  console.log('     accessToken,');
  console.log('     {');
  console.log('       permissions: ["InvoiceRead", "InvoiceWrite"],');
  console.log('       description: "My API integration token"');
  console.log('     }');
  console.log('   );');
  console.log('');
  console.log('   // Store the token securely - it\'s only shown once!');
  console.log('   console.log("Token:", newToken.token);');
  console.log('   console.log("Reference:", newToken.referenceNumber);');

  // Uncomment to actually generate a token:
  // const newToken = await client.tokens.generateToken(
  //   config.accessToken,
  //   {
  //     permissions,
  //     description: 'Demo token - delete after testing'
  //   }
  // );
  // console.log(`\n   ✓ Token generated!`);
  // console.log(`   Reference: ${newToken.referenceNumber}`);
  // console.log(`   Token: ${newToken.token}`);

  // Step 5: Token status check
  printStep(5, 5, 'Token status check demonstration...');
  
  console.log('\n   📋 To check token status:');
  console.log('');
  console.log('   const status = await client.tokens.getToken(');
  console.log('     accessToken,');
  console.log('     tokenReferenceNumber');
  console.log('   );');
  console.log('');
  console.log('   📋 To revoke a token:');
  console.log('');
  console.log('   await client.tokens.revokeToken(');
  console.log('     accessToken,');
  console.log('     tokenReferenceNumber');
  console.log('   );');

  printSuccess('Token management demonstration completed!');

  // =============================================
  // PERMISSION TYPES REFERENCE
  // =============================================
  
  console.log('\n📋 Token Permission Types:');
  console.log('');
  console.log('   Permission          | Description');
  console.log('   --------------------|------------------------------------------');
  console.log('   InvoiceRead         | Read invoices issued to/by the entity');
  console.log('   InvoiceWrite        | Send invoices on behalf of the entity');
  console.log('   CredentialsRead     | View tokens and permissions');
  console.log('   CredentialsManage   | Create/revoke tokens and permissions');
  console.log('   SubunitManage       | Manage organizational subunits');
  console.log('   EnforcementOperations | Enforcement authority operations');
  console.log('');
  console.log('   🔒 Security Best Practices:');
  console.log('   • Grant minimum required permissions');
  console.log('   • Use separate tokens for different integrations');
  console.log('   • Rotate tokens regularly');
  console.log('   • Revoke unused tokens promptly');
  console.log('   • Store tokens securely (environment variables, secrets manager)');
}

main().catch(console.error);

