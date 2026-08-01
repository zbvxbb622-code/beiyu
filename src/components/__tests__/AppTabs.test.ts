import { describe, expect, it } from '@jest/globals';

import { hiddenTabRouteNames } from '@/components/app-tabs';

describe('AppTabs', () => {
  it('hides AI memory settings from the bottom tab bar', () => {
    expect(hiddenTabRouteNames).toContain('settings-ai-memory');
  });
});
