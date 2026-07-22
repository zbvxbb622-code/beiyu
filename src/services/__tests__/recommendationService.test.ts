import { describe, expect, it } from '@jest/globals';

import { recommendCocktails } from '../recommendationService';

describe('recommendationService', () => {
  it('prioritizes prompt keyword matches and selected cellar ingredients', () => {
    const result = recommendCocktails({
      prompt: '我想要酸甜一点，有龙舌兰和青柠',
      selectedIngredientIds: ['tequila', 'lime', 'simple-syrup'],
    });

    expect(result.recipes[0].id).toBe('classic-margarita');
    expect(result.message).toContain('龙舌兰');
    expect(result.message).toContain('3 款');
  });

  it('uses Chinese prompt terms even when no cellar ingredients are selected', () => {
    const result = recommendCocktails({
      prompt: '我想要酸甜一点，有龙舌兰和青柠',
      selectedIngredientIds: [],
    });

    expect(result.recipes[0].id).toBe('classic-margarita');
  });

  it('falls back to approachable recipes when the cellar has few matches', () => {
    const result = recommendCocktails({
      prompt: '今晚想要清爽低负担',
      selectedIngredientIds: ['ice'],
    });

    expect(result.recipes.length).toBe(3);
    expect(result.recipes.map((recipe) => recipe.id)).toContain('gin-tonic');
  });

  it('never returns more than three recommendations for the first screen', () => {
    const result = recommendCocktails({
      prompt: '派对 经典 酸甜 清爽',
      selectedIngredientIds: ['gin', 'rum', 'tequila', 'lime', 'mint'],
    });

    expect(result.recipes).toHaveLength(3);
  });
});
