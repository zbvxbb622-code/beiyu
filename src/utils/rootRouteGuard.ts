import type { AuthStatus } from '@/state/AuthState';

export type RootRouteGate = 'loading' | 'welcome' | 'loginForAi' | 'app';

export function getRootRouteGate({
  isHydrated,
  status,
  pathname,
  localAgeVerified,
  bootstrapAgeConfirmed,
}: {
  isHydrated: boolean;
  status: AuthStatus;
  pathname: string;
  localAgeVerified: boolean;
  bootstrapAgeConfirmed: boolean | null;
}): RootRouteGate {
  if (!isHydrated || status === 'restoring') {
    return 'loading';
  }

  if (status === 'signedIn' && bootstrapAgeConfirmed === true && !localAgeVerified) {
    return 'loading';
  }

  if (!localAgeVerified && !['/realname-verify', '/terms', '/privacy'].includes(pathname)) {
    return 'welcome';
  }

  if (pathname === '/ai' && status !== 'signedIn') {
    return 'loginForAi';
  }

  return 'app';
}
