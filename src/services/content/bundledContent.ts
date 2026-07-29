import { barVenues, heroSlides, homeShortcuts } from '@/data/content';
import { drinkKnowledgeEntries } from '@/data/drinkKnowledge';
import { ingredients } from '@/data/ingredients';
import { cocktailRecipes } from '@/data/recipes';
import type { ContentSnapshot } from '@/services/content/contentSchemas';

export const bundledContent: ContentSnapshot = {
  ingredients: ingredients.map(({ isSelected: _isSelected, ...ingredient }) => ingredient),
  recipes: cocktailRecipes,
  bars: barVenues,
  knowledge: drinkKnowledgeEntries,
  banners: heroSlides.map((slide) => ({
    ...slide,
    targetRoute: slide.targetRoute ?? '/ai',
  })),
  shortcuts: homeShortcuts,
};
