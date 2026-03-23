export interface AuthManager {
  getAccessToken(): string | undefined;
  setAccessToken(token: string | undefined): void;
  getRefreshToken(): string | undefined;
  setRefreshToken(token: string | undefined): void;
  onUnauthorized(): Promise<string | null>;
}

export class DefaultAuthManager implements AuthManager {
  private accessToken: string | undefined;
  private refreshToken: string | undefined;
  private readonly refreshFn: () => Promise<string | null>;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(
    refreshFn: () => Promise<string | null>,
    initialAccessToken?: string,
    initialRefreshToken?: string
  ) {
    this.refreshFn = refreshFn;
    this.accessToken = initialAccessToken;
    this.refreshToken = initialRefreshToken;
  }

  getAccessToken(): string | undefined {
    return this.accessToken;
  }

  setAccessToken(token: string | undefined): void {
    this.accessToken = token;
  }

  getRefreshToken(): string | undefined {
    return this.refreshToken;
  }

  setRefreshToken(token: string | undefined): void {
    this.refreshToken = token;
  }

  async onUnauthorized(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.refreshFn()
      .then((newToken) => {
        this.accessToken = newToken ?? undefined;
        return newToken;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }
}
