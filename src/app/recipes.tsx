import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { RecipeEditorialHero } from '@/components/mixology/RecipeEditorialHero';
import { RecipeEditorialRow } from '@/components/mixology/RecipeEditorialRow';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { SectionHeader } from '@/components/mixology/SectionHeader';
import { TopBar } from '@/components/mixology/TopBar';
import { getDailyClassicFeature } from '@/services/classicService';
import { getFeaturedRecipes } from '@/services/recipeService';
import { colors, radii, spacing } from '@/styles/mixologyTheme';

// 桌面/平板下内容居中限宽，营造杂志阅读感；窄屏铺满（页边距由 ScreenShell 提供）
const CONTENT_MAX_WIDTH = 760;

function ListEmpty({ query }: { query: string }) {
  return (
    <View style={styles.empty} testID="recipes-empty">
      <Text style={styles.emptyTitle}>没有找到相关内容</Text>
      <Text style={styles.emptyHint}>
        {query.trim() ? '换几个关键词试试，比如“金酒”、“清爽”' : '经典系列空空如也'}
      </Text>
    </View>
  );
}

function RowSeparator() {
  return <View style={styles.separator} />;
}

function todayLabel(): string {
  const now = new Date();

  return `${now.getMonth() + 1}月${now.getDate()}日`;
}

export default function RecipesScreen() {
  const [query, setQuery] = useState('');
  const { width } = useWindowDimensions();
  const recipes = getFeaturedRecipes();
  const daily = useMemo(() => getDailyClassicFeature(), []);
  const dateLabel = useMemo(() => todayLabel(), []);

  const normalized = query.trim().toLowerCase();
  const isSearching = normalized.length > 0;

  const filteredRecipes = useMemo(() => {
    if (!isSearching) {
      return recipes;
    }

    return recipes.filter((recipe) =>
      [recipe.name, recipe.englishName, recipe.description, ...recipe.tags, ...recipe.ingredients.map((item) => item.name)]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [isSearching, normalized, recipes]);

  const hasResults = filteredRecipes.length > 0;
  const isWide = width > CONTENT_MAX_WIDTH;

  return (
    <ScreenShell>
      <TopBar title="经典系列" />
      <View style={[styles.shell, { maxWidth: isWide ? CONTENT_MAX_WIDTH : '100%', alignSelf: 'center' }]}>
        <View style={styles.searchBox}>
          <Search color={colors.textMuted} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索酒款、风味..."
            placeholderTextColor="#806f79"
            style={styles.searchInput}
          />
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          {!isSearching && (
            <View style={styles.heroWrap}>
              <RecipeEditorialHero recipe={daily} dateLabel={dateLabel} />
            </View>
          )}

          {isSearching && !hasResults && <ListEmpty query={query} />}

          {filteredRecipes.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="经典酒款" subtitle="穿越百年的杯中经典" />
              {filteredRecipes.map((recipe, index) => (
                <View key={recipe.id}>
                  <RecipeEditorialRow recipe={recipe} />
                  {index < filteredRecipes.length - 1 && <RowSeparator />}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
  },
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
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.bottomNavPadding,
  },
  // 推荐大图与经典酒款直接衔接，两者之间不保留间距
  heroWrap: {
    marginBottom: 0,
  },
  section: {
    marginTop: 0,
  },
  // 卡片之间的留白：在原有细分隔线两侧增加呼吸空间，提升层次感与可读性
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
