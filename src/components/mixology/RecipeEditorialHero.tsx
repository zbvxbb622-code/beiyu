import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronRight, Clock, Martini } from 'lucide-react-native';
import { ImageBackground, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { getContentImageSource, getImageAsset } from '@/data/imageAssets';
import { colors, gradients, radii } from '@/styles/mixologyTheme';
import type { CocktailRecipe } from '@/types/mixology';

// 编辑杂志风「本周精选」头部：一张大图建立视觉锚点，
// 底部叠加渐变与文案，点击进入详情。仅用于经典系列页 A 版布局。
// 布局放在内部 View 上，避免 NativeWind css-interop 在 Expo 原生端丢失 Pressable 样式。
export function RecipeEditorialHero({
  recipe,
  dateLabel,
}: {
  recipe: CocktailRecipe;
  dateLabel?: string;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  return (
    <Pressable
      testID="recipe-hero"
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
      style={({ pressed }) => [styles.root, pressed ? styles.pressed : null]}>
      <View style={styles.hero}>
        <ImageBackground
          testID="recipe-hero-image"
          source={getContentImageSource(recipe.imageKey, recipe.imageUrl)}
          defaultSource={getImageAsset(recipe.imageKey)}
          resizeMode="cover"
          style={[styles.heroImage, compact ? styles.heroImageCompact : null]}
          imageStyle={styles.heroImageRadius}>
          <LinearGradient colors={gradients.overlayBottom} style={styles.heroOverlay}>
            <View style={[styles.heroTag, compact ? styles.heroTagCompact : null]}>
              <Text style={[styles.heroTagText, compact ? styles.heroTagTextCompact : null]}>
                每日推荐
              </Text>
            </View>
            {dateLabel ? (
              <Text style={[styles.heroDate, compact ? styles.heroDateCompact : null]}>
                {dateLabel}
              </Text>
            ) : null}
            <Text style={[styles.heroTitle, compact ? styles.heroTitleCompact : null]}>
              {recipe.name}
            </Text>
            <Text style={[styles.heroEnglish, compact ? styles.heroEnglishCompact : null]}>
              {recipe.englishName}
            </Text>
            <Text
              style={[styles.heroDescription, compact ? styles.heroDescriptionCompact : null]}
              numberOfLines={compact ? 1 : 2}>
              {recipe.description}
            </Text>
            <View style={[styles.heroMetaRow, compact ? styles.heroMetaRowCompact : null]}>
              <View style={styles.metaPill}>
                <Clock color={colors.cyan} size={compact ? 12 : 13} />
                <Text style={[styles.metaText, compact ? styles.metaTextCompact : null]}>
                  {recipe.prepMinutes}分钟
                </Text>
              </View>
              <View style={styles.metaPill}>
                <Martini color={colors.pink} size={compact ? 12 : 13} />
                <Text style={[styles.metaText, compact ? styles.metaTextCompact : null]}>
                  {recipe.difficulty}
                </Text>
              </View>
              <View style={styles.heroCta}>
                <Text style={[styles.heroCtaText, compact ? styles.heroCtaTextCompact : null]}>
                  查看配方
                </Text>
                <ChevronRight color={colors.text} size={compact ? 14 : 16} />
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  pressed: {
    opacity: 0.9,
  },
  hero: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: colors.panel,
  },
  heroImage: {
    height: 208,
  },
  heroImageCompact: {
    height: 176,
  },
  heroImageRadius: {
    borderRadius: radii.lg,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 18,
  },
  heroTag: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: colors.pink,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },
  heroTagCompact: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  heroTagText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  heroTagTextCompact: {
    fontSize: 11,
  },
  heroDate: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
  },
  heroDateCompact: {
    fontSize: 11,
    marginTop: 5,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
  },
  heroTitleCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  heroEnglish: {
    color: colors.textSoft,
    fontSize: 15,
    marginTop: 2,
  },
  heroEnglishCompact: {
    fontSize: 13,
  },
  heroDescription: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  heroDescriptionCompact: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  heroMetaRowCompact: {
    gap: 6,
    marginTop: 10,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  metaTextCompact: {
    fontSize: 11,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  heroCtaText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  heroCtaTextCompact: {
    fontSize: 12,
  },
});
