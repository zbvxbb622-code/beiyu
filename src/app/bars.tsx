import { type Href, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarVenueCard } from '@/components/mixology/BarVenueCard';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { getBarVenues } from '@/services/contentService';
import { useMixology } from '@/state/MixologyState';
import { colors, spacing } from '@/styles/mixologyTheme';

type BarsTab = {
  id: 'discover' | 'following' | 'nearby';
  label: string;
};

const tabs: BarsTab[] = [
  { id: 'discover', label: '推荐' },
  { id: 'following', label: '关注' },
  { id: 'nearby', label: '附近' },
];

export default function BarsScreen() {
  const router = useRouter();
  const { interactionState, toggleVenueFavorite } = useMixology();
  const [activeTab, setActiveTab] = useState<BarsTab['id']>('discover');
  const venues = getBarVenues();
  // 「关注」展示已收藏酒吧；推荐/附近沿用 Mock 全量列表
  const visibleVenues = activeTab === 'following' ? venues.filter((venue) => interactionState.favoriteVenueIds.includes(venue.id)) : venues;

  return (
    <ScreenShell padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.navigate('/' as Href)} hitSlop={12} style={styles.back}>
          <ChevronLeft color={colors.pink} size={30} />
        </Pressable>
        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={styles.tab}>
              <Text style={[styles.tabText, activeTab === tab.id ? styles.tabTextActive : null]}>{tab.label}</Text>
              {activeTab === tab.id ? <View style={styles.tabIndicator} /> : null}
            </Pressable>
          ))}
        </View>
        <View style={styles.back} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {visibleVenues.map((venue) => (
          <BarVenueCard
            key={venue.id}
            venue={venue}
            favorite={interactionState.favoriteVenueIds.includes(venue.id)}
            onToggleFavorite={() => toggleVenueFavorite(venue.id)}
          />
        ))}
        {visibleVenues.length === 0 ? <Text style={styles.empty}>还没有关注的酒吧，去推荐页挑一家吧</Text> : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  back: {
    width: 40,
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
  },
  tab: {
    alignItems: 'center',
    minWidth: 40,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 17,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '800',
  },
  tabIndicator: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.pink,
    marginTop: 5,
  },
  list: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: spacing.bottomNavPadding,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 48,
  },
});
