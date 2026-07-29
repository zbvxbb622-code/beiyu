import { describe, expect, it } from '@jest/globals';

import { bundledContent } from '@/services/content/bundledContent';
import {
  CONTENT_CACHE_SCHEMA_VERSION,
  contentCacheSchema,
  contentSnapshotSchema,
} from '@/services/content/contentSchemas';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('content schemas', () => {
  it('accepts the bundled content snapshot', () => {
    const parsed = contentSnapshotSchema.parse(bundledContent);

    expect(parsed.recipes.length).toBeGreaterThan(0);
    expect(parsed.bars.length).toBeGreaterThan(0);
  });

  it('accepts bundled content after a JSON cache round trip', () => {
    expect(() =>
      contentSnapshotSchema.parse(JSON.parse(JSON.stringify(bundledContent)))
    ).not.toThrow();
  });

  it('rejects a recipe without preparation steps', () => {
    const invalid = clone(bundledContent) as Record<string, unknown>;
    const recipes = invalid.recipes as Record<string, unknown>[];
    delete recipes[0].steps;

    expect(() => contentSnapshotSchema.parse(invalid)).toThrow();
  });

  it('rejects a shortcut route outside the app allowlist', () => {
    const invalid = clone(bundledContent) as Record<string, unknown>;
    const shortcuts = invalid.shortcuts as Record<string, unknown>[];
    shortcuts[0].route = 'https://untrusted.example';

    expect(() => contentSnapshotSchema.parse(invalid)).toThrow();
  });

  it('rejects cache entries from an incompatible schema version', () => {
    expect(() =>
      contentCacheSchema.parse({
        schemaVersion: CONTENT_CACHE_SCHEMA_VERSION + 1,
        fetchedAt: new Date().toISOString(),
        payload: bundledContent,
      })
    ).toThrow();
  });

  it('accepts a current cache entry', () => {
    expect(() =>
      contentCacheSchema.parse({
        schemaVersion: CONTENT_CACHE_SCHEMA_VERSION,
        fetchedAt: '2026-07-29T08:00:00.000Z',
        payload: JSON.parse(JSON.stringify(bundledContent)),
      })
    ).not.toThrow();
  });
});
