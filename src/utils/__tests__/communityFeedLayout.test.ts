import { describe, expect, it } from '@jest/globals';

import { getCompactFeedImageHeight, splitMasonryColumns } from '@/utils/communityFeedLayout';

describe('community feed layout helpers', () => {
  it('splits posts into stable left and right masonry columns', () => {
    const columns = splitMasonryColumns(['a', 'b', 'c', 'd', 'e']);

    expect(columns.left).toEqual(['a', 'c', 'e']);
    expect(columns.right).toEqual(['b', 'd']);
  });

  it('keeps community images compact on narrow mobile cards', () => {
    expect(getCompactFeedImageHeight(166, 0)).toBeLessThanOrEqual(148);
    expect(getCompactFeedImageHeight(166, 1)).toBeLessThanOrEqual(148);
    expect(getCompactFeedImageHeight(166, 2)).toBeGreaterThanOrEqual(108);
  });
});
