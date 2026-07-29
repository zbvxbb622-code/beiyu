import { describe, expect, it, jest } from '@jest/globals';
import { z } from 'zod';

import {
  ApiError,
  createAuthenticatedClient,
  type FetchLike,
} from '@/services/api/authenticatedClient';

const responseSchema = z.object({ value: z.string() });

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async (): Promise<unknown> => body,
  } as unknown as Response;
}

async function successfulRefresh(): Promise<void> {
  return undefined;
}

function deferred<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve: resolve!, reject: reject! };
}

function createClient(
  fetch: FetchLike,
  refresh: () => Promise<void>,
  onUnauthorized = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
) {
  let accessToken = 'stale-access-token';
  const client = createAuthenticatedClient({
    apiBaseUrl: 'https://api.example.test/api/v1',
    fetch,
    getAccessToken: () => accessToken,
    refresh: async () => {
      await refresh();
      accessToken = 'fresh-access-token';
    },
    onUnauthorized,
    timeoutMs: 25,
  });

  return { client, onUnauthorized };
}

describe('authenticated client', () => {
  it('coalesces concurrent 401 refreshes and retries each request once', async () => {
    const refreshGate = deferred<void>();
    const refresh = jest.fn(() => refreshGate.promise);
    const fetchMock = jest
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'AUTH_EXPIRED', message: 'Expired', details: {} } }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'AUTH_EXPIRED', message: 'Expired', details: {} } }, 401))
      .mockResolvedValueOnce(jsonResponse({ value: 'first' }))
      .mockResolvedValueOnce(jsonResponse({ value: 'second' }));
    const { client, onUnauthorized } = createClient(fetchMock, refresh);

    const first = client.request('/me/bootstrap', {}, responseSchema);
    const second = client.request('/cellar/items', {}, responseSchema);

    while (refresh.mock.calls.length === 0) {
      await Promise.resolve();
    }
    expect(refresh).toHaveBeenCalledTimes(1);

    refreshGate.resolve();

    await expect(Promise.all([first, second])).resolves.toEqual([
      { value: 'first' },
      { value: 'second' },
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('cleans up after a retried request is still unauthorized without leaking request data', async () => {
    const fetchMock = jest
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'AUTH_EXPIRED', message: 'Expired', details: {} } }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'AUTH_EXPIRED', message: 'Expired', details: {} } }, 401));
    const { client, onUnauthorized } = createClient(fetchMock, successfulRefresh);

    const request = client.request(
      '/me/profile',
      { body: JSON.stringify({ password: 'do-not-expose' }) },
      responseSchema
    );

    await expect(request).rejects.toMatchObject({
      code: 'AUTH_EXPIRED',
      status: 401,
      details: {},
    });
    await request.catch((error: unknown) => expect(error).toBeInstanceOf(ApiError));

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('keeps a retried unauthorized response stable when cleanup fails', async () => {
    const fetchMock = jest
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'AUTH_EXPIRED', message: 'Expired', details: {} } }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'AUTH_EXPIRED', message: 'Expired', details: {} } }, 401));
    const onUnauthorized = jest
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('secure storage unavailable'));
    const { client } = createClient(fetchMock, successfulRefresh, onUnauthorized);

    await expect(client.request('/me/profile', {}, responseSchema)).rejects.toMatchObject({
      code: 'AUTH_EXPIRED',
      status: 401,
      details: {},
    });
  });

  it('returns 204 responses without reading JSON', async () => {
    let jsonCalls = 0;
    const fetchMock = jest.fn<FetchLike>().mockResolvedValue({
      ok: true,
      status: 204,
      json: async (): Promise<unknown> => {
        jsonCalls += 1;
        throw new Error('204 responses have no JSON body');
      },
    } as unknown as Response);
    const { client } = createClient(fetchMock, successfulRefresh);

    await expect(client.request('/auth/logout', { method: 'POST' }, z.undefined())).resolves.toBeUndefined();
    expect(jsonCalls).toBe(0);
  });

  it('normalizes invalid JSON without exposing access tokens or request bodies', async () => {
    const fetchMock = jest.fn<FetchLike>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async (): Promise<unknown> => Promise.reject(new Error('Unexpected token')),
    } as unknown as Response);
    const { client } = createClient(fetchMock, successfulRefresh);

    await expect(
      client.request('/me/profile', { body: JSON.stringify({ secret: 'do-not-expose' }) }, responseSchema)
    ).rejects.toMatchObject({ code: 'invalid-response', status: 200, details: {} });
  });

  it('normalizes timed out requests without exposing access tokens or request bodies', async () => {
    const fetchMock = jest.fn<FetchLike>(() => new Promise<Response>(() => undefined));
    const { client } = createClient(fetchMock, successfulRefresh);

    await expect(
      client.request('/me/profile', { body: JSON.stringify({ secret: 'do-not-expose' }) }, responseSchema)
    ).rejects.toMatchObject({ code: 'request-timeout', status: 0, details: {} });
  });

  it('normalizes schema mismatches without exposing access tokens or request bodies', async () => {
    const fetchMock = jest.fn<FetchLike>().mockResolvedValue(jsonResponse({ unexpected: true }));
    const { client } = createClient(fetchMock, successfulRefresh);

    await expect(
      client.request('/me/profile', { body: JSON.stringify({ secret: 'do-not-expose' }) }, responseSchema)
    ).rejects.toMatchObject({ code: 'invalid-response', status: 200, details: {} });
  });
});
