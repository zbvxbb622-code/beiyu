import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { RecipeCard } from '@/components/mixology/RecipeCard';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { TopBar } from '@/components/mixology/TopBar';
import { getFeaturedRecipes } from '@/services/recipeService';
import { colors, radii } from '@/styles/mixologyTheme';

export default function RecipesScreen() {
  const [query, setQuery] = useState('');
  const recipes = getFeaturedRecipes();
  const filteredRecipes = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return recipes;
    }

    return recipes.filter((recipe) =>
      [recipe.name, recipe.englishName, recipe.description, ...recipe.tags, ...recipe.ingredients.map((item) => item.name)]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, recipes]);

  return (
    <ScreenShell>
      <TopBar title="经典系列" />
      <View style={styles.searchBox}>
        <Search color={colors.textMuted} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜索金酒、酸甜、清爽..."
          placeholderTextColor="#806f79"
          style={styles.searchInput}
        />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {filteredRecipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  content: {
    paddingBottom: 34,
  },
});
