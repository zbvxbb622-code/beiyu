import { act, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';

import { bundledContent } from '@/services/content/bundledContent';
import type {
  ContentRepository,
  RefreshResult,
} from '@/services/content/contentRepository';
import type { ContentSnapshot } from '@/services/content/contentSchemas';
import { ContentProvider, useContent } from '@/state/ContentState';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function createFakeRepository(options?: {
  cached?: ContentSnapshot;
  remote?: ContentSnapshot;
  hydrateGate?: ReturnType<typeof deferred<RefreshResult>>;
  refreshGate?: ReturnType<typeof deferred<RefreshResult>>;
}) {
  let snapshot = bundledContent;
  const listeners = new Set<() => void>();
  const unsubscribe = jest.fn();

  const notify = (next: ContentSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  const repository: ContentRepository = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        unsubscribe();
      };
    },
    hydrate: jest.fn(async (): Promise<RefreshResult> => {
      if (options?.hydrateGate) {
        await options.hydrateGate.promise;
      }
      if (options?.cached) {
        notify(options.cached);
        return { ok: true, source: 'cache' };
      }
      return { ok: false, source: 'bundled', error: 'cache-invalid' };
    }),
    refresh: jest.fn(async (): Promise<RefreshResult> => {
      if (options?.refreshGate) {
        await options.refreshGate.promise;
      }
      if (options?.remote) {
        notify(options.remote);
        return { ok: true, source: 'remote' };
      }
      return { ok: false, source: 'bundled', error: 'not-configured' };
    }),
    clearCache: jest.fn(async () => undefined),
  };

  return { repository, unsubscribe };
}

function Probe() {
  const { snapshot, isHydrated, isRefreshing } = useContent();
  return (
    <Text>
      {snapshot.banners[0].title}|{isHydrated ? 'hydrated' : 'bundled'}|
      {isRefreshing ? 'refreshing' : 'idle'}
    </Text>
  );
}

describe('ContentProvider', () => {
  it('renders bundled content before asynchronous hydration', async () => {
    const hydrateGate = deferred<RefreshResult>();
    const { repository } = createFakeRepository({ hydrateGate });

    const screen = await render(
      <ContentProvider repository={repository}>
        <Probe />
      </ContentProvider>
    );

    expect(screen.getByText(/欢迎来到.*bundled/s)).toBeTruthy();
    await screen.unmount();
    await act(async () => {
      hydrateGate.resolve({ ok: false, source: 'bundled', error: 'cache-invalid' });
      await hydrateGate.promise;
    });
  });

  it('hydrates cache and then updates from background refresh', async () => {
    const cached = clone(bundledContent);
    cached.banners[0].title = '缓存标题';
    const remote = clone(bundledContent);
    remote.banners[0].title = '远程标题';
    const refreshGate = deferred<RefreshResult>();
    const { repository } = createFakeRepository({
      cached,
      remote,
      refreshGate,
    });
    const screen = await render(
      <ContentProvider repository={repository}>
        <Probe />
      </ContentProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/缓存标题.*hydrated.*refreshing/s)).toBeTruthy();
    });

    await act(async () => {
      refreshGate.resolve({ ok: true, source: 'remote' });
      await refreshGate.promise;
    });

    await waitFor(() => {
      expect(screen.getByText(/远程标题.*hydrated.*idle/s)).toBeTruthy();
    });
    await screen.unmount();
  });

  it('unsubscribes and ignores asynchronous completion after unmount', async () => {
    const hydrateGate = deferred<RefreshResult>();
    const { repository, unsubscribe } = createFakeRepository({ hydrateGate });
    const screen = await render(
      <ContentProvider repository={repository}>
        <Probe />
      </ContentProvider>
    );

    await screen.unmount();
    await act(async () => {
      hydrateGate.resolve({ ok: false, source: 'bundled', error: 'cache-invalid' });
      await hydrateGate.promise;
    });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(repository.refresh).not.toHaveBeenCalled();
  });
});
