import { useRouter } from 'expo-router';
import { ChevronRight, Clock } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ContentImage } from '@/components/content/ContentImage';
import { colors, radii } from '@/styles/mixologyTheme';
import type { CocktailRecipe } from '@/types/mixology';

// 编辑杂志风清单行：左缩略图 + 中标题/英文/简介 + 右时长·难度与箭头。
// 复用 recipe-card 这个 testID，便于现有页面级测试继续命中。
// 布局放在内部 View 上，避免 NativeWind css-interop 在 Expo 原生端丢失 Pressable 样式。
export function RecipeEditorialRow({ recipe }: { recipe: CocktailRecipe }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  return (
    <Pressable
      testID="recipe-card"
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
      style={({ pressed }) => [styles.root, pressed ? styles.pressed : null]}>
      <View style={styles.row}>
        <ContentImage
          testID="recipe-card-image"
          imageKey={recipe.imageKey}
          imageUrl={recipe.imageUrl}
          resizeMode="cover"
          style={[styles.thumb, compact ? styles.thumbCompact : null]}
        />
        <View style={styles.copy}>
          <Text style={[styles.title, compact ? styles.titleCompact : null]}>{recipe.name}</Text>
          <Text style={styles.english}>{recipe.englishName}</Text>
          <Text style={styles.description} numberOfLines={compact ? 1 : 2}>
            {recipe.description}
          </Text>
        </View>
        <View style={[styles.tail, compact ? styles.tailCompact : null]}>
          <View style={styles.metaPill}>
            <Clock color={colors.cyan} size={compact ? 11 : 12} />
            <Text style={[styles.metaText, compact ? styles.metaTextCompact : null]}>
              {recipe.prepMinutes}分钟
            </Text>
          </View>
          <Text style={[styles.difficulty, compact ? styles.difficultyCompact : null]}>
            {recipe.difficulty}
          </Text>
          <ChevronRight color={colors.textMuted} size={compact ? 16 : 18} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: 18,
    paddingHorizontal: 2,
  },
  pressed: {
    opacity: 0.72,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    marginRight: 14,
  },
  thumbCompact: {
    width: 72,
    height: 72,
    marginRight: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  titleCompact: {
    fontSize: 16,
    lineHeight: 21,
  },
  english: {
    color: colors.textSoft,
    fontSize: 13,
    marginTop: 1,
  },
  description: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  tail: {
    alignItems: 'flex-end',
    marginLeft: 10,
    gap: 6,
  },
  tailCompact: {
    marginLeft: 8,
    gap: 4,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  metaText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  metaTextCompact: {
    fontSize: 11,
  },
  difficulty: {
    color: colors.textMuted,
    fontSize: 12,
  },
  difficultyCompact: {
    fontSize: 11,
  },
});
