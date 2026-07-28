import { describe, expect, it } from '@jest/globals';

import { cocktailRecipes } from '@/data/recipes';
import { getDailyClassicFeature } from '@/services/classicService';

describe('classicService', () => {
  it('picks a deterministic feature for the same date', () => {
    const date = new Date('2026-07-26T12:00:00');

    const pickA = getDailyClassicFeature(date);
    const pickB = getDailyClassicFeature(date);

    expect(pickA).toEqual(pickB);
  });

  it('only picks cocktails that exist in the source data', () => {
    const date = new Date('2026-07-26T12:00:00');
    const feature = getDailyClassicFeature(date);

    expect(cocktailRecipes.some((recipe) => recipe.id === feature.id)).toBe(true);
  });

  it('rotates across days (different seeds yield valid features)', () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((day) => new Date(`2026-07-${day}T12:00:00`));
    const picks = days.map((day) => getDailyClassicFeature(day));

    for (const feature of picks) {
      expect(cocktailRecipes.some((recipe) => recipe.id === feature.id)).toBe(true);
    }
  });
});
