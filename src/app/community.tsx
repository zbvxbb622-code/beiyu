import { type Href, useRouter } from 'expo-router';
import { MessageCircle, Plus, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CommunityPostCard } from '@/components/mixology/CommunityPostCard';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { getCommunityPosts } from '@/services/contentService';
import { useMixology } from '@/state/MixologyState';
import { colors, spacing } from '@/styles/mixologyTheme';
import type { FeedCategory } from '@/types/mixology';
import { getCompactFeedImageHeight, splitMasonryColumns } from '@/utils/communityFeedLayout';

type CommunityTab = {
  id: 'following' | 'discover' | 'nearby';
  label: string;
  category: FeedCategory;
};

const tabs: CommunityTab[] = [
  { id: 'following', label: '关注', category: 'following' },
  { id: 'discover', label: '发现', category: 'recommended' },
  { id: 'nearby', label: '附近', category: 'nearby' },
];

const feedHorizontalPadding = 14;
const columnGap = 10;
const maxFeedWidth = 620;

export default function CommunityScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CommunityTab['id']>('discover');
  const { interactionState, togglePostLike } = useMixology();
  const { width } = useWindowDimensions();
  const activeCategory = tabs.find((tab) => tab.id === activeTab)?.category ?? 'recommended';
  const posts = useMemo(() => getCommunityPosts(activeCategory, interactionState.localCommunityPosts), [activeCategory, interactionState.localCommunityPosts]);
  const feedWidth = Math.min(width, maxFeedWidth);
  const cardWidth = Math.floor((feedWidth - feedHorizontalPadding * 2 - columnGap) / 2);
  const columns = useMemo(() => splitMasonryColumns(posts), [posts]);

  return (
    <ScreenShell padded={false}>
      <View style={styles.surface}>
        <View style={styles.header}>
          <MessageCircle color={colors.text} size={28} />
          <View style={styles.tabs}>
            {tabs.map((tab) => (
              <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={styles.tab}>
                <Text style={[styles.tabText, activeTab === tab.id ? styles.tabTextActive : null]}>{tab.label}</Text>
                {activeTab === tab.id ? <View style={styles.tabIndicator} /> : null}
              </Pressable>
            ))}
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push('/search' as Href)} hitSlop={8}>
              <Search color={colors.text} size={26} />
            </Pressable>
            <Pressable onPress={() => router.push('/publish-post' as Href)} hitSlop={8} style={styles.publishButton}>
              <Plus color={colors.text} size={26} />
            </Pressable>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.feed}>
          <View style={[styles.feedInner, { width: feedWidth }]}>
            <View style={styles.masonryColumns}>
              <View style={[styles.column, { width: cardWidth }]}>
                {columns.left.map((post, index) => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    liked={interactionState.likedPostIds.includes(post.id)}
                    onToggleLike={() => togglePostLike(post.id)}
                    cardWidth={cardWidth}
                    imageHeight={getCompactFeedImageHeight(cardWidth, index * 2)}
                  />
                ))}
              </View>
              <View style={[styles.column, styles.rightColumn, { width: cardWidth }]}>
                {columns.right.map((post, index) => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    liked={interactionState.likedPostIds.includes(post.id)}
                    onToggleLike={() => togglePostLike(post.id)}
                    cardWidth={cardWidth}
                    imageHeight={getCompactFeedImageHeight(cardWidth, index * 2 + 1)}
                  />
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(10,0,5,0.72)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,47,159,0.14)',
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 8,
  },
  tab: {
    alignItems: 'center',
    minWidth: 40,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 17,
    fontWeight: '900',
  },
  tabTextActive: {
    color: colors.text,
  },
  tabIndicator: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.pink,
    marginTop: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  publishButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feed: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: spacing.bottomNavPadding,
  },
  feedInner: {
    paddingHorizontal: feedHorizontalPadding,
  },
  masonryColumns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: columnGap,
  },
  column: {
    gap: 10,
  },
  rightColumn: {
    paddingTop: 16,
  },
});
