import { describe, expect, it } from '@jest/globals';

import { cocktailRecipes } from '@/data/recipes';
import { getDrinkKnowledgeByRecipeId, getDrinkKnowledgeEntries } from '@/services/knowledgeService';

describe('knowledgeService', () => {
  it('returns knowledge entries with meaning and story (not menu descriptions)', () => {
    const entries = getDrinkKnowledgeEntries();

    expect(entries.length).toBeGreaterThanOrEqual(10);
    for (const entry of entries) {
      expect(entry.meaning.length).toBeGreaterThan(0);
      expect(entry.story.length).toBeGreaterThan(20);
      expect(entry.era).toContain('·');
      expect(entry.symbols.length).toBeGreaterThan(0);
    }
  });

  it('every knowledge entry links to an existing recipe', () => {
    const recipeIds = new Set(cocktailRecipes.map((recipe) => recipe.id));

    for (const entry of getDrinkKnowledgeEntries()) {
      if (entry.recipeId) {
        expect(recipeIds.has(entry.recipeId)).toBe(true);
      }
    }
  });

  it('finds knowledge by recipe id', () => {
    const entry = getDrinkKnowledgeByRecipeId('negroni');

    expect(entry?.name).toBe('尼格罗尼');
    expect(entry?.story).toContain('内格罗尼伯爵');
  });
});
