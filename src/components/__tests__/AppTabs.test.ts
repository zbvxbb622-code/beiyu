import { describe, expect, it } from '@jest/globals';

import { hiddenTabRouteNames, tabIconMetrics } from '@/components/app-tabs';

describe('AppTabs', () => {
  it('hides AI memory settings from the bottom tab bar', () => {
    expect(hiddenTabRouteNames).toContain('settings-ai-memory');
  });

  it('uses one stable icon frame for every bottom tab and an inline AI glyph', () => {
    expect(tabIconMetrics).toEqual({
      frameSize: 28,
      glyphSize: 24,
      aiBubbleSize: 55,
      aiGlyphSize: 30,
      aiGlyphSource: 'inline-svg',
    });
  });
});
