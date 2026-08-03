import { type ReactNode, useEffect, useRef } from 'react';

import { useAuth } from '@/state/AuthState';
import { useMixology } from '@/state/MixologyState';

export function AuthenticatedMixologyBridge({ children }: { children: ReactNode }) {
  const { bootstrapData, session, status } = useAuth();
  const { applyBootstrap, isHydrated } = useMixology();
  const appliedUserIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!isHydrated || status !== 'signedIn' || !bootstrapData) {
      return;
    }

    const bootstrapKey = `${session?.generation ?? 0}:${bootstrapData.user.id}`;
    if (appliedUserIdsRef.current.has(bootstrapKey)) {
      return;
    }

    appliedUserIdsRef.current.add(bootstrapKey);
    void applyBootstrap(bootstrapData);
  }, [applyBootstrap, bootstrapData, isHydrated, session?.generation, status]);

  return <>{children}</>;
}
