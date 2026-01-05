import type { HttpClient } from '@/utils/http.js';
import { API_V2_BASE_URLS, type ApiV2Environment } from './types/common.js';

export type PublicKeyUsage = 'KsefTokenEncryption' | 'SymmetricKeyEncryption';

interface PublicKeyCertificate {
  certificate: string;
  validFrom: string;
  validTo: string;
  usage: PublicKeyUsage[];
}

interface CachedPublicKey {
  usage: PublicKeyUsage;
  pem: string;
  validTo: string;
}

/**
 * Retrieves and caches MF public keys as described in
 * https://github.com/CIRFMF/ksef-docs/blob/main/przeglad-kluczowych-zmian-ksef-api-2-0.md#obowiązkowe-szyfrowanie-wszystkich-faktur
 * and https://api-test.ksef.mf.gov.pl/docs/v2/index.html#tag/Certyfikaty-klucza-publicznego .
 */
export class SecurityService {
  private cache: CachedPublicKey[] = [];
  private readonly baseUrl: string;

  constructor(
    private readonly httpClient: HttpClient,
    environment: ApiV2Environment
  ) {
    this.baseUrl = API_V2_BASE_URLS[environment];
  }

  async getPublicKey(usage: PublicKeyUsage): Promise<string> {
    const cached = this.cache.find(
      (entry) => entry.usage === usage && new Date(entry.validTo) > new Date()
    );
    if (cached) {
      return cached.pem;
    }

    const response = await this.httpClient.request<PublicKeyCertificate[]>({
      method: 'GET',
      url: `${this.baseUrl}/security/public-key-certificates`
    });

    const matching = response.data.find((cert) => cert.usage?.includes(usage));
    if (!matching) {
      throw new Error(`No public key certificate found for usage ${usage}`);
    }

    const pem = convertDerBase64ToPem(matching.certificate);
    this.cache = this.cache.filter((entry) => entry.usage !== usage);
    this.cache.push({
      usage,
      pem,
      validTo: matching.validTo
    });
    return pem;
  }
}

function convertDerBase64ToPem(encoded: string): string {
  const derBuffer = Buffer.from(encoded, 'base64');
  const base64 = derBuffer.toString('base64');
  const formatted = base64.match(/.{1,64}/g)?.join('\n') ?? base64;
  return `-----BEGIN CERTIFICATE-----\n${formatted}\n-----END CERTIFICATE-----\n`;
}
