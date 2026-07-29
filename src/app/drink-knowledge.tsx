import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { BookOpen, ChevronRight, Quote } from 'lucide-react-native';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ContentImageBackground } from '@/components/content/ContentImage';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { TopBar } from '@/components/mixology/TopBar';
import { useContent } from '@/state/ContentState';
import { colors, gradients, radii, spacing } from '@/styles/mixologyTheme';

export default function DrinkKnowledgeScreen() {
  const router = useRouter();
  const { snapshot, isRefreshing, lastRefreshError, refresh } = useContent();
  const entries = snapshot.knowledge;

  return (
    <ScreenShell>
      <TopBar title="酒品知识" backHref={'/' as Href} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.pink}
          />
        }>
        {lastRefreshError ? (
          <Text style={styles.refreshNotice}>{lastRefreshError}</Text>
        ) : null}
        <View style={styles.intro}>
          <BookOpen color={colors.pink} size={20} />
          <Text style={styles.introText}>每杯酒都有自己的寓意和故事{'\n'}读懂它，再举杯</Text>
        </View>

        {entries.map((entry) => (
          <View key={entry.id} style={styles.card} testID="knowledge-card">
            <ContentImageBackground
              imageKey={entry.imageKey}
              imageUrl={entry.imageUrl}
              resizeMode="cover"
              style={styles.cover}
              imageStyle={styles.coverRadius}
            >
              <LinearGradient colors={gradients.overlayTop} style={styles.coverOverlay}>
                <View style={styles.eraBadge}>
                  <Text style={styles.eraText}>{entry.era}</Text>
                </View>
                <View style={styles.coverTitleWrap}>
                  <Text style={styles.name}>{entry.name}</Text>
                  <Text style={styles.englishName}>{entry.englishName}</Text>
                </View>
              </LinearGradient>
            </ContentImageBackground>

            <View style={styles.body}>
              <View style={styles.meaningRow}>
                <Quote color={colors.pink} size={16} />
                <Text style={styles.meaning}>{entry.meaning}</Text>
              </View>
              <Text style={styles.story}>{entry.story}</Text>
              <View style={styles.symbolRow}>
                {entry.symbols.map((symbol) => (
                  <Text key={symbol} style={styles.symbol}>
                    {symbol}
                  </Text>
                ))}
              </View>
              {entry.recipeId ? (
                <Pressable
                  onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: entry.recipeId } } as unknown as Href)}
                  style={styles.recipeLink}
                >
                  <Text style={styles.recipeLinkText}>查看「{entry.name}」的配方</Text>
                  <ChevronRight color={colors.pink} size={16} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.bottomNavPadding,
  },
  refreshNotice: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  introText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
  },
  cover: {
    height: 150,
  },
  coverRadius: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  coverOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 14,
  },
  eraBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  eraText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '800',
  },
  coverTitleWrap: {},
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  englishName: {
    color: colors.textSoft,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
  },
  body: {
    padding: 14,
  },
  meaningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  meaning: {
    flex: 1,
    color: colors.pink,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  story: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 22,
  },
  symbolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  symbol: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '800',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  recipeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 12,
    alignSelf: 'flex-start',
    minHeight: 40,
  },
  recipeLinkText: {
    color: colors.pink,
    fontSize: 14,
    fontWeight: '800',
  },
});
