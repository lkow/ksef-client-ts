import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CollectiveIdentifiersService,
  KsefApiV2Client,
  type CollectiveIdentifierPaginationOptions,
  type GenerateCollectiveIdentifierRequest
} from '../../src/index.js';
import { HttpClient, type HttpRequestOptions, type HttpResponse } from '../../src/utils/http.js';
import { KsefApiError } from '../../src/types/common.js';
import { createMockHttpClient } from '../helpers/mock-http-client.js';

const ksefNumber = '1111111111-20260612-6310EC800000-DA';
const collectiveIdentifierNumber = '1111111111-IZ202607-65ED02180000-E7';
const generationRequest: GenerateCollectiveIdentifierRequest = {
  invoices: [
    { ksefNumber, payment: { amount: 100.25, currency: 'PLN' }, description: 'First payment' },
    { ksefNumber: '1111111111-20260612-62EAFD400000-B3' }
  ]
};
const queryRequest = {
  dateCreatedFrom: '2026-07-01T00:00:00Z',
  dateCreatedTo: '2026-08-01T00:00:00Z',
  createdInCurrentContext: false,
  invoiceCountFrom: 0
};

class TransportHttpClient extends HttpClient {
  constructor(private readonly run: () => Promise<HttpResponse<unknown>>) {
    super({ maxRetries: 3, retryDelay: 0 });
  }

  protected override async executeRequest<T>(_options: HttpRequestOptions, _url: URL): Promise<HttpResponse<T>> {
    return await this.run() as HttpResponse<T>;
  }
}

describe('CollectiveIdentifiersService', () => {
  const mock = createMockHttpClient();
  const http = mock as unknown as HttpClient;

  beforeEach(() => mock.reset());

  it('generates an identifier with explicit authorization and preserves optional payment details', async () => {
    mock.mockResponse({ collectiveIdentifierNumber }, { status: 201 });
    const service = new CollectiveIdentifiersService(http, 'demo');

    expect(await service.generate('access-token', generationRequest)).toEqual({ collectiveIdentifierNumber });
    expect(mock.getLastRequest()).toMatchObject({
      method: 'POST',
      url: 'https://api-demo.ksef.mf.gov.pl/v2/collective-identifiers',
      headers: { Authorization: 'Bearer access-token' },
      maxRetries: 0,
      skipAuthRetry: true
    });
    expect(JSON.parse(mock.getLastRequest()!.body!)).toEqual(generationRequest);
  });

  it.each([
    new Error('Connection closed before the response arrived'),
    new KsefApiError('Server error after accepting the request', { statusCode: 500 })
  ])('does not retry an uncertain generation result: %s', async (error) => {
    const transport = vi.fn().mockRejectedValueOnce(error).mockResolvedValue({
      status: 201, statusText: 'Created', headers: {}, data: { collectiveIdentifierNumber }
    });
    const service = new CollectiveIdentifiersService(new TransportHttpClient(transport), 'demo');
    await expect(service.generate('token', generationRequest)).rejects.toBe(error);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([400, 403])('preserves API errors with status %s', async (statusCode) => {
    const error = new KsefApiError('Request rejected', { statusCode });
    mock.mockError(error);
    const service = new CollectiveIdentifiersService(http, 'test');
    await expect(service.generate('token', generationRequest)).rejects.toBe(error);
  });

  const reads = [
    {
      name: 'query', method: 'POST', path: '/collective-identifiers/query', body: queryRequest, pageSize: 200,
      call: (service: CollectiveIdentifiersService, options: CollectiveIdentifierPaginationOptions) =>
        service.query('token', queryRequest, options)
    },
    {
      name: 'queryInvoices', method: 'POST', path: '/collective-identifiers/invoices',
      body: { collectiveIdentifierNumbers: [collectiveIdentifierNumber, '1111111111-IZ202608-65ED02180000-E7'] },
      pageSize: 500,
      call: (service: CollectiveIdentifiersService, options: CollectiveIdentifierPaginationOptions) =>
        service.queryInvoices('token', {
          collectiveIdentifierNumbers: [collectiveIdentifierNumber, '1111111111-IZ202608-65ED02180000-E7']
        }, options)
    },
    {
      name: 'queryByKsefNumber', method: 'GET', path: `/collective-identifiers/ksef/${ksefNumber}`,
      body: undefined, pageSize: 200,
      call: (service: CollectiveIdentifiersService, options: CollectiveIdentifierPaginationOptions) =>
        service.queryByKsefNumber('token', ksefNumber, options)
    }
  ];

  it.each(reads)('$name sends its body/query and carries the continuation token only in the header', async ({ method, path, body, pageSize, call }) => {
    const service = new CollectiveIdentifiersService(http, 'demo');
    const response = { invoices: [], collectiveIdentifiers: [], continuationToken: 'next+/=' };
    mock.mockResponseOnce(response);
    mock.mockResponseOnce({ invoices: [], collectiveIdentifiers: [], continuationToken: null });

    const firstPage = await call(service, { pageSize });
    expect(firstPage).toEqual(response);
    expect(mock.getLastRequest()?.headers?.['x-continuation-token']).toBeUndefined();
    const lastPage = await call(service, { pageSize, continuationToken: firstPage.continuationToken! });
    expect(lastPage.continuationToken).toBeNull();

    const requests = mock.getRequests();
    for (const request of requests) {
      expect(request.method).toBe(method);
      expect(request.url).toBe(`https://api-demo.ksef.mf.gov.pl/v2${path}?pageSize=${pageSize}`);
      expect(request.headers?.Authorization).toBe('Bearer token');
      expect(request.body ? JSON.parse(request.body) : undefined).toEqual(body);
    }
    expect(requests[1]?.headers?.['x-continuation-token']).toBe('next+/=');
  });

  it('does not turn hidden payment details into empty or zero values', async () => {
    const invoices = [
      { ksefNumber, collectiveIdentifierNumber, detailsHidden: true },
      { ksefNumber, collectiveIdentifierNumber, detailsHidden: false, payment: null, description: null },
      { ksefNumber, collectiveIdentifierNumber, detailsHidden: false, payment: { amount: 12.34, currency: 'PLN' } }
    ];
    mock.mockResponse({ invoices });
    const service = new CollectiveIdentifiersService(http, 'test');
    const result = await service.queryInvoices('token', { collectiveIdentifierNumbers: [collectiveIdentifierNumber] });
    expect(result.invoices).toEqual(invoices);
    expect(result.invoices[0]).not.toHaveProperty('payment');
    expect(mock.getLastRequest()?.url).toBe('https://api-test.ksef.mf.gov.pl/v2/collective-identifiers/invoices');
  });

  it('encodes the KSeF number as a single path segment', async () => {
    const service = new CollectiveIdentifiersService(http, 'test');
    await service.queryByKsefNumber('token', 'value/with?reserved#characters');
    expect(mock.getLastRequest()?.url).toBe('https://api-test.ksef.mf.gov.pl/v2/collective-identifiers/ksef/value%2Fwith%3Freserved%23characters');
  });

  it.each([
    ['test', 'https://api-test.ksef.mf.gov.pl/v2'],
    ['demo', 'https://api-demo.ksef.mf.gov.pl/v2'],
    ['prod', 'https://api.ksef.mf.gov.pl/v2']
  ] as const)('exposes the service through the public client for %s', async (environment, baseUrl) => {
    const client = new KsefApiV2Client({ environment, httpClient: http });
    expect(client.collectiveIdentifiers).toBeInstanceOf(CollectiveIdentifiersService);
    await client.collectiveIdentifiers.query('token', queryRequest);
    expect(mock.getLastRequest()?.url).toBe(`${baseUrl}/collective-identifiers/query`);
  });
});
