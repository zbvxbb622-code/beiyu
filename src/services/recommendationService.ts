import { cocktailRecipes } from '@/data/recipes';
import type { CocktailRecipe, RecommendationInput, RecommendationResult } from '@/types/mixology';

function keywordScore(recipe: CocktailRecipe, prompt: string) {
  const normalized = prompt.toLowerCase();
  const searchable = [
    recipe.name,
    recipe.englishName,
    recipe.description,
    ...recipe.tags,
    ...recipe.ingredients.map((item) => item.name),
    ...recipe.ingredients.map((item) => item.id),
  ]
    .join(' ')
    .toLowerCase();
  const terms = [
    recipe.name,
    recipe.englishName,
    ...recipe.tags,
    ...recipe.ingredients.map((item) => item.name),
    ...recipe.ingredients.map((item) => item.id),
  ]
    .map((term) => term.toLowerCase())
    .filter((term) => term.length >= 2);
  const directTermScore = terms.reduce((score, term) => score + (normalized.includes(term) ? 3 : 0), 0);
  const tokenScore = normalized
    .split(/\s+|，|。|、|,|\./)
    .filter(Boolean)
    .reduce((score, token) => score + (searchable.includes(token) ? 2 : 0), 0);

  return directTermScore + tokenScore;
}

function cellarScore(recipe: CocktailRecipe, selectedIngredientIds: string[]) {
  const selected = new Set(selectedIngredientIds);
  return recipe.ingredients.reduce((score, ingredient) => score + (selected.has(ingredient.id) ? 1 : 0), 0);
}

export function recommendCocktails(input: RecommendationInput): RecommendationResult {
  const ranked = cocktailRecipes
    .map((recipe) => ({
      recipe,
      score: keywordScore(recipe, input.prompt) + cellarScore(recipe, input.selectedIngredientIds),
    }))
    .sort((a, b) => b.score - a.score || a.recipe.prepMinutes - b.recipe.prepMinutes)
    .slice(0, 3)
    .map(({ recipe }) => recipe);

  const leadingIngredient = ranked[0]?.ingredients.find((ingredient) =>
    input.selectedIngredientIds.includes(ingredient.id)
  );
  const focus = leadingIngredient
    ? `我优先参考了你的${leadingIngredient.name}库存。`
    : '我先从入门、清爽、容易操作的配方开始。';

  return {
    message: `${focus} 为你筛出 ${ranked.length} 款适合现在做的鸡尾酒。`,
    recipes: ranked,
  };
}
