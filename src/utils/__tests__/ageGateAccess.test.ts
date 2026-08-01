import { describe, expect, it } from '@jest/globals';

import { canAccessBeforeAgeVerification } from '@/utils/ageGateAccess';

describe('canAccessBeforeAgeVerification', () => {
  it('allows the realname age check before the welcome gate has been completed', () => {
    expect(canAccessBeforeAgeVerification('/realname-verify')).toBe(true);
  });

  it('keeps direct phone login behind age verification', () => {
    expect(canAccessBeforeAgeVerification('/login')).toBe(false);
  });
});
