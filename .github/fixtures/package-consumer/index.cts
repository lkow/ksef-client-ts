import sdk = require('@ksef/client');
import crypto = require('@ksef/client/crypto');
import validation = require('@ksef/client/validation');

const policy: sdk.KsefApiV2.AuthorizationPolicy = { allowedIps: { ip4Addresses: ['127.0.0.1'] } };
const rootPolicy: sdk.AuthorizationPolicy = policy;
const page: sdk.KsefApiV2.PaginatedResponse<string> = { items: [] };
const rootPage: sdk.PaginatedResponse<string> = page;
const deadline: Date | null = sdk.KsefApiV2.calculateOfflineDeadline('awaria_calkowita');
const client: typeof sdk.KsefApiV2Client = sdk.KsefApiV2.KsefApiV2Client;
const tokenStatus: sdk.KsefApiV2.TokenStatusResponseRev2['status'] = {
  code: 'AwaitingApproval',
  rawCode: 'AwaitingApproval',
  displayName: 'Awaiting approval'
};
const getAuthenticationStatusRev2: (
  referenceNumber: string,
  authenticationToken: string
) => Promise<sdk.AuthenticationOperationStatusResponseRev2> =
  sdk.KsefApiV2.AuthenticationV2Service.prototype.getAuthenticationStatusRev2;
const authenticationStatus: sdk.AuthenticationOperationStatusResponseRev2['status'] = {
  code: 450, description: 'Token poza okresem ważności', details: null
};
const certificate: crypto.ParsedCertificate = {
  certificatePem: '', privateKeyPem: '', subject: '', issuer: '', fingerprint: ''
};

void [rootPolicy, rootPage, deadline, client, certificate, crypto.generateSHA256Hash, validation.validateNIP];
void [tokenStatus, getAuthenticationStatusRev2, authenticationStatus];
