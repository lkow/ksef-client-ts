import { describe, it, expect, vi } from 'vitest';
import { DefaultAuthManager } from '../src/api2/auth-manager.js';

describe('DefaultAuthManager', () => {
  it('stores and returns access/refresh tokens', () => {
    const manager = new DefaultAuthManager(async () => null, 'access-1', 'refresh-1');

    expect(manager.getAccessToken()).toBe('access-1');
    expect(manager.getRefreshToken()).toBe('refresh-1');

    manager.setAccessToken('access-2');
    manager.setRefreshToken('refresh-2');

    expect(manager.getAccessToken()).toBe('access-2');
    expect(manager.getRefreshToken()).toBe('refresh-2');
  });

  it('deduplicates concurrent refresh requests', async () => {
    const refreshFn = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return 'new-access-token';
    });
    const manager = new DefaultAuthManager(refreshFn, 'stale-token', 'refresh-token');

    const [first, second] = await Promise.all([
      manager.onUnauthorized(),
      manager.onUnauthorized()
    ]);

    expect(first).toBe('new-access-token');
    expect(second).toBe('new-access-token');
    expect(manager.getAccessToken()).toBe('new-access-token');
    expect(refreshFn).toHaveBeenCalledTimes(1);
  });

  it('clears stored access token when refresh callback returns null', async () => {
    const manager = new DefaultAuthManager(async () => null, 'stale-token', 'refresh-token');

    const refreshed = await manager.onUnauthorized();

    expect(refreshed).toBeNull();
    expect(manager.getAccessToken()).toBeUndefined();
    expect(manager.getRefreshToken()).toBe('refresh-token');
  });
});
