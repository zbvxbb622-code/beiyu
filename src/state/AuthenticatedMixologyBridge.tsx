import { type ReactNode, useEffect, useRef } from 'react';

import { useAuth } from '@/state/AuthState';
import { useMixology } from '@/state/MixologyState';

export function AuthenticatedMixologyBridge({ children }: { children: ReactNode }) {
  const { bootstrapData, status } = useAuth();
  const { applyBootstrap, isHydrated } = useMixology();
  const appliedUserIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!isHydrated || status !== 'signedIn' || !bootstrapData) {
      return;
    }

    const userId = bootstrapData.user.id;
    if (appliedUserIdsRef.current.has(userId)) {
      return;
    }

    appliedUserIdsRef.current.add(userId);
    void applyBootstrap(bootstrapData);
  }, [applyBootstrap, bootstrapData, isHydrated, status]);

  return <>{children}</>;
}
