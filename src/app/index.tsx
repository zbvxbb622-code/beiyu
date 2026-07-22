import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { BookOpen, Boxes, ChevronRight, PackageOpen, Search, Sparkles, Star } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ImageBackground,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { SectionHeader } from '@/components/mixology/SectionHeader';
import { getImageAsset } from '@/data/imageAssets';
import { getHeroSlides, getHomeShortcuts } from '@/services/contentService';
import { getFeaturedRecipes } from '@/services/recipeService';
import { colors, gradients, radii, spacing, typography } from '@/styles/mixologyTheme';

const shortcutIcons = {
  box: PackageOpen,
  book: BookOpen,
  cards: Star,
  cellar: Boxes,
};

export default function HomeScreen() {
  const router = useRouter();
  const heroSlides = getHeroSlides();
  const heroScrollRef = useRef<ScrollView>(null);
  const { width, height } = useWindowDimensions();
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const shortcuts = getHomeShortcuts();
  const recipes = getFeaturedRecipes();

  // 手机端适配：小屏降低 Hero 高度，避免首屏内容被挤压
  const isCompact = width < 380 || height < 700;
  const heroHeight = isCompact ? Math.min(360, Math.round(height * 0.42)) : 430;
  const heroTypography = isCompact ? typography.heroTitleCompact : typography.heroTitle;

  // 快捷入口：用显式像素宽度（不依赖 flex 分配），保证任何机型一排完整放下
  const shortcutGap = 10;
  const shortcutSize = Math.min(
    (width - spacing.pageX * 2 - shortcutGap * (shortcuts.length - 1)) / shortcuts.length,
    120
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveHeroIndex((currentIndex) => {
        const nextIndex = (currentIndex + 1) % heroSlides.length;
        heroScrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
        return nextIndex;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [heroSlides.length, width]);

  function handleHeroScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveHeroIndex(Math.max(0, Math.min(heroSlides.length - 1, nextIndex)));
  }

  return (
    <ScreenShell padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.hero, { height: heroHeight }]}>
          <ScrollView
            ref={heroScrollRef}
            horizontal
            pagingEnabled
            bounces={false}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleHeroScrollEnd}>
            {heroSlides.map((hero) => (
              <ImageBackground
                key={hero.id}
                source={getImageAsset(hero.imageKey)}
                resizeMode="cover"
                style={[styles.heroSlide, { width }]}
                imageStyle={styles.heroImage}>
                <LinearGradient colors={gradients.overlayTop} style={styles.heroOverlay}>
                  <View style={styles.heroCopy}>
                    <Text style={[styles.heroTitle, heroTypography]}>{hero.title}{'\n'}{hero.subtitle}</Text>
                    <Text style={styles.script}>{hero.scriptLabel}</Text>
                    <Pressable onPress={() => router.push('/ai' as Href)} style={styles.heroButton}>
                      <Text style={styles.heroButtonText}>{hero.ctaLabel}</Text>
                      <ChevronRight color={colors.text} size={20} />
                    </Pressable>
                  </View>
                </LinearGradient>
              </ImageBackground>
            ))}
          </ScrollView>
          <View style={styles.dots}>
            {heroSlides.map((hero, index) => (
              <View key={hero.id} style={[styles.dot, index === activeHeroIndex ? styles.dotActive : null]} />
            ))}
          </View>
        </View>

        <View style={styles.pageContent}>
          <Pressable onPress={() => router.push('/search' as Href)} style={styles.searchBox}>
            <TextInput
              editable={false}
              pointerEvents="none"
              placeholder="搜索酒谱、酒吧、帖子..."
              placeholderTextColor="#87757f"
              style={styles.searchInput}
            />
            <LinearGradient colors={gradients.cta} style={styles.searchButton}>
              <Search color={colors.text} size={30} />
            </LinearGradient>
          </Pressable>

          <View style={[styles.shortcuts, { gap: shortcutGap }]}>
            {shortcuts.map((shortcut) => {
              const Icon = shortcutIcons[shortcut.icon];
              return (
                <Pressable
                  key={shortcut.id}
                  onPress={() => router.push(shortcut.route as Href)}
                  style={({ pressed }) => [styles.shortcut, { width: shortcutSize }, pressed ? styles.pressed : null]}>
                  <View style={[styles.shortcutIcon, { width: shortcutSize, height: shortcutSize }]}>
                    <Icon color={colors.text} size={28} />
                    {shortcut.id === 'shared-cellar' ? <Sparkles color={colors.pink} size={13} style={styles.shortcutSparkle} /> : null}
                  </View>
                  <Text style={styles.shortcutTitle}>{shortcut.title}</Text>
                </Pressable>
              );
            })}
          </View>

          <SectionHeader title="最新酒单" actionLabel="查看全部 >" />
          <View style={styles.recipeGrid}>
            {recipes.slice(0, 4).map((recipe, index) => (
              <Pressable
                key={recipe.id}
                onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
                style={[styles.recipeTile, index === 0 ? styles.recipeWide : null]}>
                <ImageBackground source={getImageAsset(recipe.imageKey)} resizeMode="cover" style={styles.recipeImage} imageStyle={styles.recipeRadius}>
                  <LinearGradient colors={gradients.overlayTop} style={styles.recipeOverlay}>
                    <Text style={styles.recipeName}>{recipe.name}</Text>
                    <Text style={styles.recipeEnglish}>{recipe.englishName}</Text>
                  </LinearGradient>
                </ImageBackground>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.bottomNavPadding,
  },
  hero: {
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
  },
  heroSlide: {
    height: '100%',
  },
  heroImage: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.pageX,
    paddingBottom: 48,
  },
  heroCopy: {
    maxWidth: 280,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 38,
    fontWeight: '300',
  },
  script: {
    color: colors.pink,
    fontSize: 30,
    fontStyle: 'italic',
    marginTop: -2,
    textShadowColor: colors.shadowPink,
    textShadowRadius: 10,
  },
  heroButton: {
    alignSelf: 'flex-start',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.pinkDark,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  heroButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 22,
    flexDirection: 'row',
    alignSelf: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: colors.text,
  },
  pageContent: {
    paddingHorizontal: spacing.pageX,
    paddingTop: 24,
  },
  searchBox: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pink,
    paddingLeft: 20,
    paddingRight: 6,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcuts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  shortcut: {
    alignItems: 'center',
    gap: 8,
  },
  pressed: {
    opacity: 0.82,
  },
  shortcutIcon: {
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,47,159,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,47,159,0.18)',
  },
  shortcutSparkle: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  shortcutTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  recipeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recipeTile: {
    width: '47.5%',
  },
  recipeWide: {
    width: '100%',
  },
  recipeImage: {
    height: 132,
  },
  recipeRadius: {
    borderRadius: radii.md,
  },
  recipeOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    borderRadius: radii.md,
    padding: 14,
  },
  recipeName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  recipeEnglish: {
    color: colors.textSoft,
    fontSize: 13,
    marginTop: 2,
  },
});
