import { recommendCocktails } from '@/services/recommendationService';
import type { ChatMessage, RecommendationInput } from '@/types/mixology';

export function createMockAiReply(input: RecommendationInput) {
  const result = recommendCocktails(input);
  const recipeNames = result.recipes.map((recipe) => recipe.name).join('、');
  const message: ChatMessage = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    text: `Mixology 已根据你的口味筛出 ${result.recipes.length} 杯：${recipeNames}。先从第一杯开始，酸甜、香气和难度都比较稳。`,
    recipeIds: result.recipes.map((recipe) => recipe.id),
  };

  return {
    message,
    recipes: result.recipes,
  };
}
