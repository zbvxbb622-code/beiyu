import { describe, expect, it } from '@jest/globals';

import { getRootRouteGate } from '@/utils/rootRouteGuard';

describe('getRootRouteGate', () => {
  it('waits for signed-in bootstrap age state before rendering the ai route', () => {
    expect(getRootRouteGate({
      isHydrated: true,
      status: 'signedIn',
      pathname: '/ai',
      localAgeVerified: false,
      bootstrapAgeConfirmed: true,
    })).toBe('loading');
  });

  it('redirects unauthenticated ai access to login with next target', () => {
    expect(getRootRouteGate({
      isHydrated: true,
      status: 'signedOut',
      pathname: '/ai',
      localAgeVerified: true,
      bootstrapAgeConfirmed: null,
    })).toBe('loginForAi');
  });
});
