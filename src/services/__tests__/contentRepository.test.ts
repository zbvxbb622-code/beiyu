import { describe, expect, it, jest } from '@jest/globals';

import { bundledContent } from '@/services/content/bundledContent';
import {
  CONTENT_CACHE_KEY,
  createContentRepository,
} from '@/services/content/contentRepository';
import { CONTENT_CACHE_SCHEMA_VERSION } from '@/services/content/contentSchemas';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createStorage(initialValue: string | null = null) {
  return {
    getItem: jest.fn(async () => initialValue),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  };
}

function contentResponses(snapshot = bundledContent) {
  return {
    '/api/v1/home': {
      banners: snapshot.banners,
      shortcuts: snapshot.shortcuts,
      featuredRecipes: snapshot.recipes.slice(0, 6),
      featuredBars: snapshot.bars.slice(0, 4),
    },
    '/api/v1/ingredients?page=1&pageSize=100': {
      items: snapshot.ingredients,
      pagination: { page: 1, pageSize: 100, totalItems: snapshot.ingredients.length, totalPages: 1 },
    },
    '/api/v1/recipes?page=1&pageSize=100': {
      items: snapshot.recipes,
      pagination: { page: 1, pageSize: 100, totalItems: snapshot.recipes.length, totalPages: 1 },
    },
    '/api/v1/bars?page=1&pageSize=100': {
      items: snapshot.bars,
      pagination: { page: 1, pageSize: 100, totalItems: snapshot.bars.length, totalPages: 1 },
    },
    '/api/v1/knowledge?page=1&pageSize=100': {
      items: snapshot.knowledge,
      pagination: { page: 1, pageSize: 100, totalItems: snapshot.knowledge.length, totalPages: 1 },
    },
  };
}

function successfulFetch(snapshot = bundledContent) {
  const responses = contentResponses(snapshot);
  return jest.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const payload = responses[`${url.pathname}${url.search}` as keyof typeof responses];
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    } as Response;
  });
}

describe('content repository', () => {
  it('exposes bundled content synchronously', () => {
    const repository = createContentRepository({
      storage: createStorage(),
    });

    expect(repository.getSnapshot()).toBe(bundledContent);
  });

  it('hydrates a valid cache before network refresh', async () => {
    const cached = clone(bundledContent);
    cached.banners[0].title = '缓存中的首页';
    const storage = createStorage(
      JSON.stringify({
        schemaVersion: CONTENT_CACHE_SCHEMA_VERSION,
        fetchedAt: '2026-07-29T08:00:00.000Z',
        payload: cached,
      })
    );
    const repository = createContentRepository({ storage });

    const result = await repository.hydrate();

    expect(result).toEqual({ ok: true, source: 'cache' });
    expect(repository.getSnapshot().banners[0].title).toBe('缓存中的首页');
  });

  it('atomically updates memory and cache after a valid remote refresh', async () => {
    const remote = clone(bundledContent);
    remote.banners[0].title = '后台发布的新首页';
    const storage = createStorage();
    const fetchMock = successfulFetch(remote);
    const repository = createContentRepository({
      apiBaseUrl: 'http://127.0.0.1:8000',
      fetch: fetchMock,
      storage,
      now: () => new Date('2026-07-29T09:00:00.000Z'),
    });

    const result = await repository.refresh();

    expect(result).toEqual({ ok: true, source: 'remote' });
    expect(repository.getSnapshot().banners[0].title).toBe('后台发布的新首页');
    expect(storage.setItem).toHaveBeenCalledWith(
      CONTENT_CACHE_KEY,
      expect.stringContaining('后台发布的新首页')
    );
  });

  it.each([
    ['server error', async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response],
    ['invalid json', async () => ({ ok: true, status: 200, json: async () => Promise.reject(new Error('bad json')) }) as unknown as Response],
    ['invalid shape', async () => ({ ok: true, status: 200, json: async () => ({ items: 'bad' }) }) as Response],
  ])('retains current content after %s', async (_, responseFactory) => {
    const storage = createStorage();
    const repository = createContentRepository({
      apiBaseUrl: 'http://127.0.0.1:8000',
      fetch: jest.fn(responseFactory),
      storage,
    });
    const before = repository.getSnapshot();

    const result = await repository.refresh();

    expect(result.ok).toBe(false);
    expect(repository.getSnapshot()).toBe(before);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('retains current content after a request timeout', async () => {
    const fetchMock = jest.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    const repository = createContentRepository({
      apiBaseUrl: 'http://127.0.0.1:8000',
      fetch: fetchMock,
      storage: createStorage(),
      timeoutMs: 5,
    });
    const before = repository.getSnapshot();

    const result = await repository.refresh();

    expect(result.ok).toBe(false);
    expect(repository.getSnapshot()).toBe(before);
  });

  it('does not call fetch when the API URL is missing', async () => {
    const fetchMock = successfulFetch();
    const repository = createContentRepository({
      fetch: fetchMock,
      storage: createStorage(),
    });

    const result = await repository.refresh();

    expect(result).toEqual({ ok: false, source: 'bundled', error: 'not-configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('notifies subscribers only when visible content changes', async () => {
    const remote = clone(bundledContent);
    const fetchMock = successfulFetch(remote);
    const repository = createContentRepository({
      apiBaseUrl: 'http://127.0.0.1:8000',
      fetch: fetchMock,
      storage: createStorage(),
    });
    const listener = jest.fn();
    repository.subscribe(listener);

    await repository.refresh();
    expect(listener).not.toHaveBeenCalled();

    remote.banners[0].title = '真正变化的标题';
    fetchMock.mockImplementation(successfulFetch(remote));
    await repository.refresh();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
