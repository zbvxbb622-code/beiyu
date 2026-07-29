import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  contentRepository,
  type ContentRepository,
  type RefreshResult,
} from '@/services/content/contentRepository';
import type { ContentSnapshot } from '@/services/content/contentSchemas';

type ContentContextValue = {
  snapshot: ContentSnapshot;
  isHydrated: boolean;
  isRefreshing: boolean;
  lastRefreshError: string | null;
  refresh: () => Promise<RefreshResult>;
};

const ContentContext = createContext<ContentContextValue | null>(null);

function refreshErrorMessage(result: RefreshResult): string | null {
  if (result.ok) {
    return null;
  }
  if (result.error === 'not-configured') {
    return '当前使用本地内容';
  }
  return '更新失败，已继续显示现有内容';
}

export function ContentProvider({
  children,
  repository = contentRepository,
}: {
  children: ReactNode;
  repository?: ContentRepository;
}) {
  const [snapshot, setSnapshot] = useState(() => repository.getSnapshot());
  const [isHydrated, setIsHydrated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshError, setLastRefreshError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const runRefresh = useCallback(
    async (reportError: boolean) => {
      if (isMountedRef.current) {
        setIsRefreshing(true);
      }
      const result = await repository.refresh();
      if (isMountedRef.current) {
        setSnapshot(repository.getSnapshot());
        setIsRefreshing(false);
        if (reportError) {
          setLastRefreshError(refreshErrorMessage(result));
        }
      }
      return result;
    },
    [repository]
  );

  const refresh = useCallback(() => runRefresh(true), [runRefresh]);

  useEffect(() => {
    isMountedRef.current = true;
    let isActive = true;
    const unsubscribe = repository.subscribe(() => {
      if (isActive) {
        setSnapshot(repository.getSnapshot());
      }
    });

    async function initialize() {
      await repository.hydrate();
      if (!isActive) {
        return;
      }
      setSnapshot(repository.getSnapshot());
      setIsHydrated(true);
      await runRefresh(false);
    }

    void initialize();

    return () => {
      isActive = false;
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [repository, runRefresh]);

  const value = useMemo(
    () => ({
      snapshot,
      isHydrated,
      isRefreshing,
      lastRefreshError,
      refresh,
    }),
    [isHydrated, isRefreshing, lastRefreshError, refresh, snapshot]
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentContextValue {
  const value = useContext(ContentContext);
  if (!value) {
    throw new Error('useContent must be used within ContentProvider');
  }
  return value;
}
