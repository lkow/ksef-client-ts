import { KsefApiV2, KsefApiV2Client, calculateOfflineDeadline } from '@ksef/client';
import type { AllowedIps, AuthorizationPolicy, PaginatedResponse, OfflineInvoiceMetadata } from '@ksef/client';
import type { GenerateTokenRequestRev2, TokenStatusResponseRev2 } from '@ksef/client';
import { generateSHA256Hash, type ParsedCertificate } from '@ksef/client/crypto';
import { validateNIP, validateApiV2ContextIdentifier } from '@ksef/client/validation';

const ips: AllowedIps = { ip4Addresses: ['127.0.0.1'] };
const policy: KsefApiV2.AuthorizationPolicy = { allowedIps: ips };
const rootPolicy: AuthorizationPolicy = policy;
const environment: KsefApiV2.ApiV2Environment = 'test';
const page: KsefApiV2.PaginatedResponse<string> = { items: [] };
const rootPage: PaginatedResponse<string> = page;
const metadata: Pick<OfflineInvoiceMetadata, 'submitBy'> = { submitBy: null };
const client: typeof KsefApiV2Client = KsefApiV2.KsefApiV2Client;
const tokenRequest: KsefApiV2.GenerateTokenRequestRev2 = { permissions: ['InvoiceRead'], description: 'Example' };
const rootTokenRequest: GenerateTokenRequestRev2 = tokenRequest;
const getTokenRev2: (accessToken: string, referenceNumber: string) => Promise<TokenStatusResponseRev2> =
  KsefApiV2.TokenService.prototype.getTokenRev2;
const deadline: Date | null = calculateOfflineDeadline('awaria_calkowita');
const certificate: ParsedCertificate = {
  certificatePem: '', privateKeyPem: '', subject: '', issuer: '', fingerprint: ''
};
validateApiV2ContextIdentifier({ type: KsefApiV2.ContextIdentifierType.NIP, value: '1234567890' });

void [rootPolicy, environment, rootPage, metadata, client, deadline, certificate, generateSHA256Hash, validateNIP];
void [rootTokenRequest, getTokenRev2];
