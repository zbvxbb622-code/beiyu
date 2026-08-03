import { type Href, useRouter } from 'expo-router';
import { ChevronLeft, SquarePen } from 'lucide-react-native';
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
  id: 'discover' | 'following' | 'nearby';
  label: string;
  category: FeedCategory;
};

const tabs: CommunityTab[] = [
  { id: 'discover', label: '推荐', category: 'recommended' },
  { id: 'following', label: '关注', category: 'following' },
  { id: 'nearby', label: '附近', category: 'nearby' },
];

const feedHorizontalPadding = 12;
const columnGap = 9;
const maxFeedWidth = 620;

export default function CommunityScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CommunityTab['id']>('discover');
  const { interactionState, togglePostLike } = useMixology();
  const { width } = useWindowDimensions();
  const activeCategory = tabs.find((tab) => tab.id === activeTab)?.category ?? 'recommended';
  const posts = useMemo(
    () => getCommunityPosts(
      activeCategory,
      interactionState.localCommunityPosts,
      interactionState.followedAuthorIds
    ),
    [activeCategory, interactionState.followedAuthorIds, interactionState.localCommunityPosts]
  );
  const feedWidth = Math.min(width, maxFeedWidth);
  const cardWidth = Math.floor((feedWidth - feedHorizontalPadding * 2 - columnGap) / 2);
  const columns = useMemo(() => splitMasonryColumns(posts), [posts]);

  return (
    <ScreenShell padded={false}>
      <View style={styles.surface}>
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
          <Pressable
            testID="community-publish-button"
            onPress={() => router.push('/publish-post' as Href)}
            hitSlop={10}
            style={({ pressed }) => [styles.publishButton, pressed ? styles.pressed : null]}
            accessibilityLabel="发布笔记">
            <SquarePen color={colors.text} size={20} strokeWidth={2.4} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.feed}>
          <View style={[styles.feedInner, { width: feedWidth }]}>
            <View style={styles.masonryColumns}>
              <View style={[styles.column, { width: cardWidth }]}>
                {columns.left.map((post, index) => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    liked={post.likedByMe ?? interactionState.likedPostIds.includes(post.id)}
                    onToggleLike={() => togglePostLike(post.id)}
                    cardWidth={cardWidth}
                    imageWidth={cardWidth}
                    imageHeight={getCompactFeedImageHeight(cardWidth, index * 2)}
                  />
                ))}
              </View>
              <View style={[styles.column, { width: cardWidth }]}>
                {columns.right.map((post, index) => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    liked={post.likedByMe ?? interactionState.likedPostIds.includes(post.id)}
                    onToggleLike={() => togglePostLike(post.id)}
                    cardWidth={cardWidth}
                    imageWidth={cardWidth}
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
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  back: {
    width: 40,
  },
  publishButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pink,
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
  feed: {
    alignItems: 'center',
    paddingTop: 10,
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
    gap: 12,
  },
  pressed: {
    opacity: 0.78,
  },
});
