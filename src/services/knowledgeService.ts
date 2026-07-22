import { drinkKnowledgeEntries } from '@/data/drinkKnowledge';
import type { DrinkKnowledgeEntry } from '@/types/mixology';

export function getDrinkKnowledgeEntries(): DrinkKnowledgeEntry[] {
  return drinkKnowledgeEntries;
}

export function getDrinkKnowledgeByRecipeId(recipeId: string): DrinkKnowledgeEntry | undefined {
  return drinkKnowledgeEntries.find((entry) => entry.recipeId === recipeId);
}
