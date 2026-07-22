import { describe, expect, it } from '@jest/globals';

import { blindBoxCards } from '@/data/blindBoxCards';
import { canDrawToday, drawCard, todayKey } from '@/services/blindBoxService';

describe('blindBoxService', () => {
  it('canDrawToday only blocks when last draw is today', () => {
    expect(canDrawToday(null)).toBe(true);
    expect(canDrawToday('2000-01-01')).toBe(true);
    expect(canDrawToday(todayKey())).toBe(false);
  });

  it('drawCard always returns a card from the pool', () => {
    for (let i = 0; i < 50; i += 1) {
      const card = drawCard();
      expect(blindBoxCards.some((item) => item.id === card.id)).toBe(true);
    }
  });

  it('drawCard respects rarity weights (legendary only at the tail)', () => {
    // random() = 0.999 应命中权重表末尾的卡牌
    const last = drawCard(() => 0.9999);
    expect(blindBoxCards[blindBoxCards.length - 1].id).toBe(last.id);
    // random() = 0 命中第一张卡
    const first = drawCard(() => 0);
    expect(blindBoxCards[0].id).toBe(first.id);
  });
});
