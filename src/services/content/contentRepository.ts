import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchContentSnapshot, type FetchLike } from '@/services/content/apiClient';
import { bundledContent } from '@/services/content/bundledContent';
import {
  CONTENT_CACHE_SCHEMA_VERSION,
  contentCacheSchema,
  type ContentCache,
  type ContentSnapshot,
} from '@/services/content/contentSchemas';

export const CONTENT_CACHE_KEY = 'beiyu.content.v1';

export type ContentStorage = Pick<
  typeof AsyncStorage,
  'getItem' | 'setItem' | 'removeItem'
>;

export type RefreshResult =
  | { ok: true; source: 'cache' | 'remote' }
  | {
      ok: false;
      source: 'bundled' | 'cache' | 'remote';
      error: 'not-configured' | 'cache-invalid' | 'request-failed';
    };

type ContentRepositoryOptions = {
  apiBaseUrl?: string;
  fetch?: FetchLike;
  storage?: ContentStorage;
  timeoutMs?: number;
  now?: () => Date;
};

export type ContentRepository = {
  getSnapshot(): ContentSnapshot;
  hydrate(): Promise<RefreshResult>;
  refresh(): Promise<RefreshResult>;
  subscribe(listener: () => void): () => void;
  clearCache(): Promise<void>;
};

function isSameSnapshot(left: ContentSnapshot, right: ContentSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createContentRepository(
  options: ContentRepositoryOptions = {}
): ContentRepository {
  const storage = options.storage ?? AsyncStorage;
  const fetchImplementation = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? 8_000;
  const now = options.now ?? (() => new Date());
  let snapshot = bundledContent;
  const listeners = new Set<() => void>();

  function replaceSnapshot(next: ContentSnapshot) {
    if (isSameSnapshot(snapshot, next)) {
      return;
    }
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot() {
      return snapshot;
    },

    async hydrate() {
      let rawCache: string | null;
      try {
        rawCache = await storage.getItem(CONTENT_CACHE_KEY);
      } catch {
        return { ok: false, source: 'bundled', error: 'cache-invalid' };
      }
      if (!rawCache) {
        return { ok: false, source: 'bundled', error: 'cache-invalid' };
      }

      try {
        const cache = contentCacheSchema.parse(JSON.parse(rawCache));
        replaceSnapshot(cache.payload);
        return { ok: true, source: 'cache' };
      } catch {
        try {
          await storage.removeItem(CONTENT_CACHE_KEY);
        } catch {
          // A broken native storage module must not block app startup.
        }
        return { ok: false, source: 'bundled', error: 'cache-invalid' };
      }
    },

    async refresh() {
      if (!options.apiBaseUrl?.trim()) {
        return { ok: false, source: 'bundled', error: 'not-configured' };
      }

      try {
        const next = await fetchContentSnapshot({
          apiBaseUrl: options.apiBaseUrl,
          fetch: fetchImplementation,
          timeoutMs,
        });
        replaceSnapshot(next);
        const cache: ContentCache = {
          schemaVersion: CONTENT_CACHE_SCHEMA_VERSION,
          fetchedAt: now().toISOString(),
          payload: next,
        };
        try {
          await storage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
        } catch {
          // Fresh in-memory content remains usable when cache persistence fails.
        }
        return { ok: true, source: 'remote' };
      } catch {
        return {
          ok: false,
          source: snapshot === bundledContent ? 'bundled' : 'cache',
          error: 'request-failed',
        };
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async clearCache() {
      try {
        await storage.removeItem(CONTENT_CACHE_KEY);
      } finally {
        replaceSnapshot(bundledContent);
      }
    },
  };
}

export const contentRepository = createContentRepository({
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
});
