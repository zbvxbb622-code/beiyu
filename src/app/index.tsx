import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { ChevronRight, Search } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContentImage, ContentImageBackground } from '@/components/content/ContentImage';
import { HomeShortcutIcon } from '@/components/mixology/HomeShortcutIcon';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { bundledContent } from '@/services/content/bundledContent';
import { useContent } from '@/state/ContentState';
import { colors, spacing } from '@/styles/mixologyTheme';
import type { CocktailRecipe } from '@/types/mixology';

// —— 设计稿基准：750x1624px（即 375x812pt），所有尺寸按宽度等比缩放 ——
const DESIGN_WIDTH = 375;
// 设计稿页面左右边距 30px = 15pt
const PAGE_PADDING = 15;

const retiredShortcutIds = new Set(['shared-cellar']);
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

function beijingDateKey(date: Date) {
  const beijingDate = new Date(date.getTime() + BEIJING_OFFSET_MS);
  const year = beijingDate.getUTCFullYear();
  const month = String(beijingDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijingDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getDailyMenuRecipes(sourceRecipes: CocktailRecipe[], date = new Date()) {
  const pool = (sourceRecipes.length >= 6 ? sourceRecipes : bundledContent.recipes)
    .filter((recipe, index, recipes) => recipes.findIndex((item) => item.id === recipe.id) === index);
  const dayKey = beijingDateKey(date);
  return [...pool]
    .sort((left, right) => hashText(`${dayKey}:${left.id}`) - hashText(`${dayKey}:${right.id}`))
    .slice(0, 6);
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { snapshot, isRefreshing, lastRefreshError, refresh } = useContent();
  const heroSlides = snapshot.banners;
  const heroScrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const displayedHeroIndex = Math.min(
    activeHeroIndex,
    Math.max(0, heroSlides.length - 1)
  );
  const shortcuts = snapshot.shortcuts.filter((shortcut) => !retiredShortcutIds.has(shortcut.id));
  const [activeDailyIndex, setActiveDailyIndex] = useState(0);

  // 设计稿等比缩放因子
  const s = width / DESIGN_WIDTH;
  // Banner 750x460px，等比高度；并限制在合理区间，避免模拟器宽度回报异常导致轮播图过矮
  const bannerHeight = Math.min(Math.max(width * (460 / 750), 220), 250);
  const bannerFrame = { width, height: bannerHeight };

  const dailyMenuRecipes = getDailyMenuRecipes(snapshot.recipes);
  const activeDailyRecipe = dailyMenuRecipes[activeDailyIndex] ?? dailyMenuRecipes[0];
  const thumbnailRecipes = dailyMenuRecipes
    .map((recipe, index) => ({ recipe, index }))
    .filter((item) => item.index !== activeDailyIndex);

  const contentWidth = width - PAGE_PADDING * 2;
  const dailyFeaturedHeight = Math.max(180, contentWidth * 0.58);
  const dailyThumbnailGap = 8 * s;
  const dailyThumbnailWidth = Math.max(76, (contentWidth - dailyThumbnailGap * 3) / 4.2);
  const dailyThumbnailHeight = Math.max(88, dailyThumbnailWidth * 1.18);

  // Banner 保留自动轮播；首张仍是设计稿整幅烘焙图
  useEffect(() => {
    if (heroSlides.length <= 1) {
      return;
    }

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

  function openRecipe(recipe: CocktailRecipe) {
    router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } });
  }

  return (
    <ScreenShell padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.pink}
          />
        }>
        {/* ===== Banner 轮播（设计稿 y 0-460px）===== */}
        {heroSlides.length > 0 ? (
          <View style={[styles.hero, { height: bannerHeight, marginTop: -insets.top }]}>
            <ScrollView
              ref={heroScrollRef}
              style={bannerFrame}
              contentContainerStyle={bannerFrame}
              horizontal
              pagingEnabled
              bounces={false}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleHeroScrollEnd}>
              {heroSlides.map((hero, slideIndex) =>
                slideIndex === 0 && hero.imageKey === 'homeBanner' && !hero.imageUrl ? (
                  // 首屏：设计稿整幅烘焙图（含标题/CTA/装饰，保证 1:1）
                  <View key={hero.id} style={[styles.heroSlide, bannerFrame]}>
                    <ContentImageBackground
                      testID="home-banner"
                      imageKey={hero.imageKey}
                      imageUrl={hero.imageUrl}
                      resizeMode="cover"
                      style={bannerFrame}
                    />
                    {/* 隐形 CTA 热区：覆盖设计稿「去AI调酒」按钮位置（x 95-280px / y 305-395px） */}
                    <Pressable
                      accessibilityLabel="去AI调酒"
                      onPress={() => router.push(hero.targetRoute as Href)}
                      style={[styles.heroCtaHotspot, { left: 44 * s, top: 150 * s, width: 104 * s, height: 48 * s }]}
                    />
                  </View>
                ) : (
                  // 其余轮播页：照片 + 文字浮层，版式与首屏设计稿对齐
                  <ContentImageBackground
                    testID="home-banner"
                    key={hero.id}
                    imageKey={hero.imageKey}
                    imageUrl={hero.imageUrl}
                    resizeMode="cover"
                    style={[styles.heroSlide, bannerFrame]}>
                    <LinearGradient colors={['rgba(7,0,4,0.45)', 'rgba(7,0,4,0.15)', 'rgba(7,0,4,0.6)']} style={styles.heroOverlay}>
                      <View style={[styles.heroCopy, { marginTop: 60 * s, marginLeft: 28 * s }]}>
                        <Text style={[styles.heroTitle, { fontSize: 20 * s, lineHeight: 27 * s }]}>
                          {hero.title}
                          {'\n'}
                          {hero.subtitle}
                        </Text>
                        <Text style={[styles.script, { fontSize: 26 * s, marginTop: 6 * s, marginLeft: 8 * s }]}>{hero.scriptLabel}</Text>
                        <Pressable onPress={() => router.push(hero.targetRoute as Href)} style={{ marginTop: 14 * s }}>
                          <LinearGradient
                            colors={['#b41d2c', '#8e0f18']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={[styles.heroButton, { height: 42 * s, borderRadius: 21 * s, paddingHorizontal: 18 * s }]}>
                            <Text style={[styles.heroButtonText, { fontSize: 15 * s }]}>{hero.ctaLabel}</Text>
                            <ChevronRight color={colors.text} size={18 * s} strokeWidth={2.6} style={{ marginLeft: 2 * s }} />
                          </LinearGradient>
                        </Pressable>
                      </View>
                    </LinearGradient>
                  </ContentImageBackground>
                )
              )}
            </ScrollView>
            {/* 轮播点：首屏使用烘焙图自带圆点（像素级对齐）；滑到照片页时显示浮层圆点，圆心 y=425px、水平居中 */}
            {displayedHeroIndex > 0 ? (
              <View
                style={[
                  styles.dots,
                  {
                    bottom: bannerHeight - 215 * s,
                    left: width / 2 - 24 * s,
                  },
                ]}>
                {heroSlides.map((hero, index) => (
                  <View
                    key={hero.id}
                    style={[
                      styles.dot,
                      { width: 6 * s, height: 6 * s, borderRadius: 3 * s, marginHorizontal: 3 * s },
                      index === displayedHeroIndex ? styles.dotActive : null,
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.pageContent}>
          {lastRefreshError ? (
            <Text style={styles.refreshNotice}>{lastRefreshError}</Text>
          ) : null}
          {/* ===== 搜索栏（设计稿 y 500-600px：pill 高 100px + 右侧粉色渐变圆钮 80px）===== */}
          <Pressable
            onPress={() => router.push('/ai' as Href)}
            style={({ pressed }) => [{ marginTop: 20 * s }, pressed ? styles.pressed : null]}>
            <View
              style={[
                styles.searchBox,
                { height: 50 * s, borderRadius: 25 * s, paddingLeft: 18 * s, paddingRight: 5 * s },
              ]}>
              <Text style={styles.searchPlaceholder} numberOfLines={1}>与您的专属调酒师对话…</Text>
              <LinearGradient
                colors={['#ff2d94', '#ff3253']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.searchButton, { width: 40 * s, height: 40 * s, borderRadius: 20 * s }]}>
                <Search color={colors.text} size={20 * s} strokeWidth={2.6} />
              </LinearGradient>
            </View>
          </Pressable>

          {/* ===== 四宫格（设计稿 120px 方块 + 双色图标 + 白色标签）===== */}
          <View style={[styles.shortcuts, { marginTop: 20 * s }]}>
            {shortcuts.map((shortcut) => (
              <Pressable
                key={shortcut.id}
                onPress={() => router.push(shortcut.route as Href)}
                style={({ pressed }) => [styles.shortcut, pressed ? styles.pressed : null]}>
                <View style={[styles.shortcutIcon, { width: 60 * s, height: 60 * s, borderRadius: 9 * s }]}>
                  <HomeShortcutIcon icon={shortcut.icon} scale={s} />
                </View>
                <Text style={[styles.shortcutTitle, { marginTop: 5 * s }]}>{shortcut.title}</Text>
              </Pressable>
            ))}
          </View>

          {/* ===== 每日酒单（按北京时间日期稳定轮换）===== */}
          <View style={[styles.sectionHeader, { marginTop: 22 * s, marginBottom: 20 * s }]}>
            <Text style={styles.sectionTitle}>每日酒单</Text>
            <Pressable
              testID="daily-menu-see-all"
              onPress={() => router.push('/recipes' as Href)}
              hitSlop={10}
              style={({ pressed }) => (pressed ? styles.pressed : null)}
            >
              <Text style={styles.sectionAction}>查看全部 &gt;</Text>
            </Pressable>
          </View>

          {activeDailyRecipe ? (
            <View style={styles.dailyMenuLayout}>
              <Pressable
                testID="daily-menu-featured-card"
                onPress={() => openRecipe(activeDailyRecipe)}
                style={({ pressed }) => [
                  styles.dailyFeaturedPressable,
                  { width: contentWidth, height: dailyFeaturedHeight, borderRadius: 8 * s },
                  pressed ? styles.pressed : null,
                ]}>
                <DailyMenuTile
                  recipe={activeDailyRecipe}
                  width={contentWidth}
                  height={dailyFeaturedHeight}
                  radius={8 * s}
                  variant="featured"
                />
              </Pressable>
              <ScrollView
                testID="daily-menu-thumbnail-strip"
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.dailyThumbnailStrip, { gap: dailyThumbnailGap }]}>
                {thumbnailRecipes.map(({ recipe, index }) => (
                  <Pressable
                    key={recipe.id}
                    testID="daily-menu-thumbnail-tile"
                    onPress={() => setActiveDailyIndex(index)}
                    style={({ pressed }) => [
                      styles.dailyThumbnailPressable,
                      { width: dailyThumbnailWidth, height: dailyThumbnailHeight, borderRadius: 8 * s },
                      pressed ? styles.pressed : null,
                    ]}>
                    <DailyMenuTile
                      recipe={recipe}
                      width={dailyThumbnailWidth}
                      height={dailyThumbnailHeight}
                      radius={8 * s}
                      variant="thumbnail"
                    />
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.dailyPager}>
                {dailyMenuRecipes.map((recipe, index) => (
                  <View
                    key={recipe.id}
                    style={[styles.dailyPagerDot, index === activeDailyIndex ? styles.dailyPagerDotActive : null]}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function DailyMenuTile({
  recipe,
  width,
  height,
  radius,
  variant,
}: {
  recipe: CocktailRecipe;
  width: number;
  height: number;
  radius: number;
  variant: 'featured' | 'thumbnail';
}) {
  const featured = variant === 'featured';
  return (
    <View testID="daily-menu-tile" style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: '#1c0a11' }}>
      <ContentImage
        imageKey={recipe.imageKey}
        imageUrl={recipe.imageUrl}
        accessibilityLabel={`${recipe.name} ${recipe.englishName}`}
        resizeMode="cover"
        style={{ width, height, borderRadius: radius, backgroundColor: '#1c0a11' }}
      />
      <LinearGradient
        colors={featured ? ['rgba(0,0,0,0.03)', 'rgba(0,0,0,0.34)', 'rgba(0,0,0,0.82)'] : ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.72)']}
        style={[styles.dailyTileOverlay, featured ? styles.dailyFeaturedOverlay : styles.dailyThumbnailOverlay]}>
        <Text
          testID={featured ? 'daily-menu-featured-title' : undefined}
          style={featured ? styles.dailyFeaturedName : styles.dailyThumbnailName}
          numberOfLines={1}>
          {recipe.name}
        </Text>
        <Text style={featured ? styles.dailyFeaturedEnglish : styles.dailyThumbnailEnglish} numberOfLines={1}>
          {recipe.englishName}
        </Text>
        {featured ? (
          <>
            <Text style={styles.dailyFeaturedDescription} numberOfLines={1}>{recipe.description}</Text>
            <View style={styles.dailyDetailPill}>
              <Text style={styles.dailyDetailText}>查看详情</Text>
              <ChevronRight color={colors.text} size={13} strokeWidth={2.6} />
            </View>
          </>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.bottomNavPadding,
  },
  // —— Banner ——
  hero: {
    backgroundColor: '#0a0000',
    overflow: 'hidden',
  },
  heroSlide: {
    flexShrink: 0,
  },
  heroCtaHotspot: {
    position: 'absolute',
  },
  heroOverlay: {
    flex: 1,
  },
  heroCopy: {
    maxWidth: 300,
  },
  heroTitle: {
    color: colors.text,
    fontWeight: '300',
  },
  script: {
    color: '#e8385a',
    fontStyle: 'italic',
    fontFamily: 'Georgia',
    textShadowColor: 'rgba(232,56,90,0.4)',
    textShadowRadius: 8,
  },
  heroButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroButtonText: {
    color: colors.text,
    fontWeight: '800',
  },
  dots: {
    position: 'absolute',
    flexDirection: 'row',
  },
  dot: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: colors.text,
  },
  // —— 内容区 ——
  pageContent: {
    paddingHorizontal: PAGE_PADDING,
  },
  refreshNotice: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  pressed: {
    opacity: 0.82,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    // 设计稿描边：灰玫瑰粉（采样自原型图边缘）
    borderColor: '#a85e80',
    backgroundColor: '#0a0000',
  },
  searchPlaceholder: {
    flex: 1,
    color: '#918786',
    fontSize: 14,
  },
  searchButton: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff2f9d',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  shortcuts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shortcut: {
    alignItems: 'center',
  },
  shortcutIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    // 设计稿宫格底板暗红（采样值 #24050a）
    backgroundColor: '#24050a',
  },
  shortcutTitle: {
    color: '#f5f0f1',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionAction: {
    color: '#8b8580',
    fontSize: 12,
    fontWeight: '500',
  },
  dailyMenuLayout: {
    width: '100%',
  },
  dailyFeaturedPressable: {
    overflow: 'hidden',
  },
  dailyThumbnailStrip: {
    paddingTop: 12,
    paddingBottom: 2,
  },
  dailyThumbnailPressable: {
    overflow: 'hidden',
  },
  dailyTileOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  dailyFeaturedOverlay: {
    padding: 14,
  },
  dailyThumbnailOverlay: {
    padding: 8,
  },
  dailyFeaturedName: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  dailyFeaturedEnglish: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  dailyFeaturedDescription: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 9,
  },
  dailyDetailPill: {
    minHeight: 30,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    paddingHorizontal: 12,
    marginTop: 12,
    backgroundColor: 'rgba(118,35,58,0.82)',
  },
  dailyDetailText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  dailyThumbnailName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  dailyThumbnailEnglish: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  dailyPager: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dailyPagerDot: {
    width: 15,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  dailyPagerDotActive: {
    width: 24,
    backgroundColor: colors.pink,
  },
});
