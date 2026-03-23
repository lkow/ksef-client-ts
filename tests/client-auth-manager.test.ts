import { describe, it, expect, vi } from 'vitest';
import { KsefApiV2Client } from '../src/api2/client.js';

describe('KsefApiV2Client AuthManager helpers', () => {
  it('stores and clears authentication tokens', () => {
    const client = new KsefApiV2Client({ environment: 'test' });

    client.setAuthenticationTokens({
      accessToken: 'access-token',
      refreshToken: 'refresh-token'
    });

    expect(client.getAccessToken()).toBe('access-token');
    expect(client.getRefreshToken()).toBe('refresh-token');

    client.clearAuthenticationTokens();
    expect(client.getAccessToken()).toBeUndefined();
    expect(client.getRefreshToken()).toBeUndefined();
  });

  it('redeems and stores tokens via helper', async () => {
    const client = new KsefApiV2Client({ environment: 'test' });
    const redeemSpy = vi.spyOn(client.authentication, 'redeemTokens').mockResolvedValue({
      accessToken: {
        token: 'new-access-token',
        validUntil: '2027-01-01T00:00:00Z'
      },
      refreshToken: {
        token: 'new-refresh-token',
        validUntil: '2027-01-02T00:00:00Z'
      }
    });

    const result = await client.redeemAndStoreTokens('auth-token');

    expect(redeemSpy).toHaveBeenCalledWith('auth-token');
    expect(result.accessToken.token).toBe('new-access-token');
    expect(client.getAccessToken()).toBe('new-access-token');
    expect(client.getRefreshToken()).toBe('new-refresh-token');
  });

  it('refreshes access token from stored refresh token', async () => {
    const client = new KsefApiV2Client({ environment: 'test' });
    client.setRefreshToken('stored-refresh-token');

    const refreshSpy = vi.spyOn(client.authentication, 'refreshAccessToken').mockResolvedValue({
      accessToken: {
        token: 'refreshed-access-token',
        validUntil: '2027-01-03T00:00:00Z'
      }
    });

    const result = await client.refreshAndStoreAccessToken();

    expect(refreshSpy).toHaveBeenCalledWith('stored-refresh-token');
    expect(result.accessToken.token).toBe('refreshed-access-token');
    expect(client.getAccessToken()).toBe('refreshed-access-token');
    expect(client.getRefreshToken()).toBe('stored-refresh-token');
  });
});
