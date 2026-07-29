import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { AuthenticatedClient, FetchLike } from '@/services/api/authenticatedClient';
import { AuthRepository } from '@/services/auth/authRepository';
import { tokenStore } from '@/services/auth/tokenStore';

const validTokenResponse = {
  accessToken: 'next-access-token',
  refreshToken: 'next-refresh-token',
  expiresIn: 900,
  refreshExpiresIn: 2_592_000,
};

const validLoginResponse = {
  ...validTokenResponse,
  isNewUser: false,
  user: {
    id: '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc',
    phoneMasked: '138****0000',
    status: 'ACTIVE',
    ageConfirmed: true,
    memoryEnabled: true,
    membershipLevel: 'FREE',
  },
  device: {
    id: '5364864c-3a48-4ca8-90b7-04f049b3227b',
    platform: 'IOS',
    deviceName: 'Test iPhone',
    appVersion: '1.0.0',
    lastActiveAt: '2026-07-29T08:00:00.000Z',
    isCurrent: true,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async (): Promise<unknown> => body,
  } as unknown as Response;
}

function rawOnlyClient(): AuthenticatedClient {
  return {
    request: async () => {
      throw new Error('authenticated client should not be used');
    },
  };
}

function createRepository(fetch: FetchLike, client?: AuthenticatedClient) {
  return new AuthRepository({
    apiBaseUrl: 'https://api.example.test/api/v1',
    fetch,
    timeoutMs: 100,
    authenticatedClient: client ?? rawOnlyClient(),
  });
}

describe('AuthRepository', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('sends SMS requests through the raw client and parses its typed response', async () => {
    const fetchMock = jest.fn<FetchLike>().mockResolvedValue(
      jsonResponse({ expiresIn: 300, retryAfter: 60 }, 202)
    );
    const repository = createRepository(fetchMock);

    await expect(repository.requestSmsCode('13800000000', 'installation-123')).resolves.toEqual({
      expiresIn: 300,
      retryAfter: 60,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/auth/sms-codes',
      expect.objectContaining({
        body: JSON.stringify({
          phone: '13800000000',
          installationId: 'installation-123',
          scene: 'LOGIN',
        }),
      })
    );
  });

  it('refreshes through the raw client and rotates the secure refresh token', async () => {
    const getRefreshToken = jest.spyOn(tokenStore, 'getRefreshToken').mockResolvedValue('stored-refresh-token');
    const setRefreshToken = jest.spyOn(tokenStore, 'setRefreshToken').mockResolvedValue();
    const fetchMock = jest.fn<FetchLike>().mockResolvedValue(jsonResponse(validTokenResponse));
    const repository = createRepository(fetchMock);

    await expect(repository.refresh()).resolves.toEqual(validTokenResponse);
    expect(getRefreshToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/auth/refresh',
      expect.objectContaining({ body: JSON.stringify({ refreshToken: 'stored-refresh-token' }) })
    );
    expect(setRefreshToken).toHaveBeenCalledWith('next-refresh-token');
  });

  it('uses the authenticated client for protected logout and clears the refresh token after its 204 response', async () => {
    const request = jest.fn(async () => undefined) as unknown as AuthenticatedClient['request'];
    const clearRefreshToken = jest.spyOn(tokenStore, 'clearRefreshToken').mockResolvedValue();
    const repository = createRepository(jest.fn<FetchLike>(), { request });

    await expect(repository.logout()).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith('/auth/logout', { method: 'POST' }, expect.anything());
    expect(clearRefreshToken).toHaveBeenCalledTimes(1);
  });

  it('sends a single-field cellar patch without clearing the other editable field', async () => {
    const request = jest.fn(async () => undefined) as unknown as AuthenticatedClient['request'];
    const repository = createRepository(jest.fn<FetchLike>(), { request });

    await repository.patchCellarItem('cellar-item-id', { note: 'Keep chilled' });

    expect(request).toHaveBeenCalledWith(
      '/cellar/items/cellar-item-id',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ note: 'Keep chilled' }),
      }),
      expect.anything()
    );
  });

  it('stores login refresh tokens from the raw typed login response', async () => {
    const setRefreshToken = jest.spyOn(tokenStore, 'setRefreshToken').mockResolvedValue();
    const fetchMock = jest.fn<FetchLike>().mockResolvedValue(jsonResponse(validLoginResponse));
    const repository = createRepository(fetchMock);

    await expect(
      repository.login({
        phone: '13800000000',
        code: '123456',
        device: {
          installationId: 'installation-123',
          platform: 'IOS',
          deviceName: 'Test iPhone',
          appVersion: '1.0.0',
        },
      })
    ).resolves.toEqual(validLoginResponse);
    expect(setRefreshToken).toHaveBeenCalledWith('next-refresh-token');
  });
});
