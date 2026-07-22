import { cocktailRecipes } from '@/data/recipes';

export function getFeaturedRecipes() {
  return cocktailRecipes;
}

export function getRecipeById(id: string) {
  return cocktailRecipes.find((recipe) => recipe.id === id);
}

export function getRecipesByIngredientIds(ingredientIds: string[]) {
  const selected = new Set(ingredientIds);

  return cocktailRecipes
    .map((recipe) => ({
      recipe,
      matches: recipe.ingredients.filter((ingredient) => selected.has(ingredient.id)).length,
    }))
    .filter(({ matches }) => matches > 0)
    .sort((a, b) => b.matches - a.matches || a.recipe.prepMinutes - b.recipe.prepMinutes)
    .map(({ recipe }) => recipe);
}
