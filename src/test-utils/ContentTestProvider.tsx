import { type ReactNode, useMemo } from 'react';

import { bundledContent } from '@/services/content/bundledContent';
import type {
  ContentRepository,
  RefreshResult,
} from '@/services/content/contentRepository';
import type { ContentSnapshot } from '@/services/content/contentSchemas';
import { ContentProvider } from '@/state/ContentState';

export function createContentTestSnapshot(): ContentSnapshot {
  return JSON.parse(JSON.stringify(bundledContent)) as ContentSnapshot;
}

export function ContentTestProvider({
  children,
  snapshot = bundledContent,
}: {
  children: ReactNode;
  snapshot?: ContentSnapshot;
}) {
  const repository = useMemo<ContentRepository>(
    () => ({
      getSnapshot: () => snapshot,
      hydrate: async (): Promise<RefreshResult> => ({
        ok: false,
        source: 'bundled',
        error: 'cache-invalid',
      }),
      refresh: async (): Promise<RefreshResult> => ({
        ok: false,
        source: 'bundled',
        error: 'not-configured',
      }),
      subscribe: () => () => undefined,
      clearCache: async () => undefined,
    }),
    [snapshot]
  );

  return <ContentProvider repository={repository}>{children}</ContentProvider>;
}
