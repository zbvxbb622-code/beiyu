import { describe, expect, it } from '@jest/globals';

import { getFeaturedRecipes, getRecipeById, getRecipesByIngredientIds } from '../recipeService';

describe('recipeService', () => {
  it('returns featured local cocktail recipes with complete detail data', () => {
    const recipes = getFeaturedRecipes();

    expect(recipes.length).toBeGreaterThanOrEqual(4);
    expect(recipes[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        englishName: expect.any(String),
        description: expect.any(String),
        ingredients: expect.any(Array),
        steps: expect.any(Array),
        prepMinutes: expect.any(Number),
      })
    );
  });

  it('finds a recipe by id for detail navigation', () => {
    const recipe = getRecipeById('classic-margarita');

    expect(recipe?.name).toBe('玛格丽特');
    expect(recipe?.ingredients.map((ingredient) => ingredient.id)).toEqual(
      expect.arrayContaining(['tequila', 'lime', 'orange-liqueur'])
    );
  });

  it('filters recipes that can use selected cellar ingredients', () => {
    const matches = getRecipesByIngredientIds(['gin', 'tonic-water', 'lime']);

    expect(matches.map((recipe) => recipe.id)).toContain('gin-tonic');
    expect(matches[0].ingredients.some((ingredient) => ingredient.id === 'gin')).toBe(true);
  });
});
